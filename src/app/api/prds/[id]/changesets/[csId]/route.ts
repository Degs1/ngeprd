import { NextRequest, NextResponse } from "next/server";
import { getOwnerId } from "@/lib/auth/owner";
import {
  getChangeSetById,
  updateChangeSet,
} from "@/lib/db/changeSetRepository";
import {
  applyChangeSetAtomic,
  revertChangeSetAtomic,
} from "@/lib/db/prdRepository";
import { ChangeSetActionSchema } from "@/lib/schemas/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
    csId: string;
  };
}

/**
 * GET /api/prds/[id]/changesets/[csId]
 * Retrieves details for a specific changeset (used for recovery after page refresh).
 * Automatically marks stale generating changesets (> 3 minutes) as failed.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const cs = await getChangeSetById(params.csId, ownerId);

    if (!cs || cs.docId.toString() !== params.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Change set tidak ditemukan" } },
        { status: 404 }
      );
    }

    // Check if generating changeset has timed out (> 3 minutes without update)
    if (
      cs.status === "generating" &&
      Date.now() - new Date(cs.updatedAt).getTime() > 3 * 60 * 1000
    ) {
      const error = {
        code: "TIMEOUT",
        message: "Pembuatan change set melebihi batas waktu 3 menit",
      };
      await updateChangeSet(cs._id, ownerId, {
        status: "failed",
        error,
      });
      cs.status = "failed";
      cs.error = error;
    }

    return NextResponse.json(cs);
  } catch (err) {
    console.error(`GET /api/prds/${params.id}/changesets/${params.csId} failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch changeset" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prds/[id]/changesets/[csId]
 * Executes actions on a changeset:
 * - { action: "apply", sectionIds?: string[] }: Atomic application across all or selected sections with baseRev check.
 * - { action: "reject" }: Marks pending changeset as rejected.
 * - { action: "revert" }: Atomic rollback of an applied changeset back to before state.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const rawBody = await req.json().catch(() => null);

    const parsed = ChangeSetActionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const actionData = parsed.data;
    const cs = await getChangeSetById(params.csId, ownerId);

    if (!cs || cs.docId.toString() !== params.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Change set tidak ditemukan" } },
        { status: 404 }
      );
    }

    // 1. Action: reject
    if (actionData.action === "reject") {
      if (cs.status !== "pending") {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `Hanya change set berstatus "pending" yang dapat ditolak (status saat ini: "${cs.status}")`,
            },
          },
          { status: 400 }
        );
      }

      await updateChangeSet(cs._id, ownerId, {
        status: "rejected",
        resolvedAt: new Date(),
      });

      return NextResponse.json({ success: true, status: "rejected" });
    }

    // 2. Action: apply
    if (actionData.action === "apply") {
      if (cs.status !== "pending") {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `Hanya change set berstatus "pending" yang dapat diterapkan (status saat ini: "${cs.status}")`,
            },
          },
          { status: 400 }
        );
      }

      const { sectionIds } = actionData;

      // Validate sectionIds if provided:
      if (sectionIds && sectionIds.length > 0) {
        // Must include origin section
        if (!sectionIds.includes(cs.originSectionId)) {
          return NextResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Penerapan change set wajib menyertakan origin section",
              },
            },
            { status: 400 }
          );
        }

        // Must only include sections that exist in the changeset
        const existingSectionIds = new Set(cs.items.map((it) => it.sectionId));
        const invalidSectionIds = sectionIds.filter((id) => !existingSectionIds.has(id));
        if (invalidSectionIds.length > 0) {
          return NextResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: `Ditemukan sectionId yang tidak ada di change set: ${invalidSectionIds.join(", ")}`,
              },
            },
            { status: 400 }
          );
        }
      }

      // Execute atomic application in MongoDB
      const applyResult = await applyChangeSetAtomic(
        params.id,
        ownerId,
        cs,
        sectionIds
      );

      if (!applyResult.success) {
        if (applyResult.conflicts && applyResult.conflicts.length > 0) {
          return NextResponse.json(
            {
              error: {
                code: "REV_CONFLICT",
                message: "Konflik versi section pada dokumen PRD",
                conflicts: applyResult.conflicts,
              },
              conflicts: applyResult.conflicts,
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: applyResult.message || "Gagal menerapkan change set",
            },
          },
          { status: 400 }
        );
      }

      // Update changeset status to 'applied', setting appliedRev per item
      const appliedSet = new Set(applyResult.appliedSectionIds);
      const updatedItems = cs.items.map((it) => {
        if (appliedSet.has(it.sectionId)) {
          return {
            ...it,
            appliedRev: it.baseRev + 1,
          };
        }
        return it;
      });

      const now = new Date();
      let updated = await updateChangeSet(cs._id, ownerId, {
        status: "applied",
        resolvedAt: now,
        items: updatedItems,
      });

      // One retry as specified in PRD Section 7.3
      if (!updated) {
        await updateChangeSet(cs._id, ownerId, {
          status: "applied",
          resolvedAt: now,
          items: updatedItems,
        });
      }

      return NextResponse.json({
        appliedSectionIds: applyResult.appliedSectionIds,
      });
    }

    // 3. Action: revert
    if (actionData.action === "revert") {
      if (cs.status !== "applied") {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `Hanya change set berstatus "applied" yang dapat diurungkan (status saat ini: "${cs.status}")`,
            },
          },
          { status: 400 }
        );
      }

      const revertResult = await revertChangeSetAtomic(params.id, ownerId, cs);
      if (!revertResult.success) {
        return NextResponse.json(
          {
            error: {
              code: "INTERNAL",
              message: revertResult.message || "Gagal mengurungkan change set",
            },
          },
          { status: 500 }
        );
      }

      await updateChangeSet(cs._id, ownerId, {
        status: "reverted",
        resolvedAt: new Date(),
      });

      return NextResponse.json({
        revertedSectionIds: revertResult.revertedSectionIds,
        skipped: revertResult.skipped,
      });
    }

    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Aksi tidak dikenal" } },
      { status: 400 }
    );
  } catch (err) {
    console.error(`POST /api/prds/${params.id}/changesets/${params.csId} failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to process changeset action" } },
      { status: 500 }
    );
  }
}
