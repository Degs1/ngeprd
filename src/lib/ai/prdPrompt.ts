/**
 * Prompt builder and templates for PRD synthesis using the ngePRD framework.
 */

export interface NormalizedAnswer {
  id?: string;
  category?: string;
  question?: string;
  answer: string;
}

/**
 * Normalizes user answers from various possible input shapes (Record, Array, Canvas answersMap)
 * into a clean array of NormalizedAnswer objects.
 */
export function normalizeAnswers(answersInput: unknown): NormalizedAnswer[] {
  if (!answersInput) return [];

  const results: NormalizedAnswer[] = [];

  // If already an array
  if (Array.isArray(answersInput)) {
    for (const item of answersInput) {
      if (!item) continue;
      if (typeof item === "string" && item.trim()) {
        results.push({ answer: item.trim() });
      } else if (typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const answer =
          typeof obj.answer === "string"
            ? obj.answer
            : typeof obj.selectedOption === "string"
            ? obj.selectedOption
            : typeof obj.label === "string"
            ? obj.label
            : "";
        if (answer) {
          results.push({
            id: typeof obj.id === "string" ? obj.id : undefined,
            category: typeof obj.category === "string" ? obj.category : undefined,
            question: typeof obj.question === "string" ? obj.question : undefined,
            answer,
          });
        }
      }
    }
    return results;
  }

  // If a Record/Map (e.g., answersMap from Zustand store or custom key-value object)
  if (typeof answersInput === "object") {
    const entries = Object.entries(answersInput as Record<string, unknown>);
    for (const [key, val] of entries) {
      if (!val) continue;

      if (typeof val === "string" && val.trim()) {
        results.push({
          id: key,
          answer: val.trim(),
        });
      } else if (typeof val === "object") {
        const obj = val as Record<string, unknown>;
        const answer =
          typeof obj.answer === "string"
            ? obj.answer
            : typeof obj.selectedOption === "string"
            ? obj.selectedOption
            : typeof obj.label === "string"
            ? obj.label
            : "";

        if (answer) {
          results.push({
            id: typeof obj.id === "string" ? obj.id : key,
            category: typeof obj.category === "string" ? obj.category : undefined,
            question: typeof obj.question === "string" ? obj.question : undefined,
            answer,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Returns system prompt instructions enforcing the ngePRD template and structure.
 */
export function getPrdSystemPrompt(): string {
  return `Kamu adalah Principal Product Architect dan Engineering Lead di platform visual planning "ngePRD".
Tugasmu adalah menyintesis ide awal produk digital dan kumpulan jawaban keputusan arsitektur menjadi dokumen Product Requirement Document (PRD) yang komprehensif, terstruktur, dan siap dieksekusi oleh solo developer atau vibe coder.

Format output HARUS selalu berupa dokumen Markdown utuh yang mengikuti template standar ngePRD berikut secara disiplin:

# Product Requirement Document (PRD)

## 1. Ringkasan
Jelaskan ringkasan produk, nilai unik (USP), dan solusi utama yang ditawarkan dalam 1-2 paragraf padat.

## 2. Masalah & Tujuan
- **Masalah**: Deskripsi masalah nyata yang dialami calon pengguna.
- **Tujuan**: Sasaran konkret produk pada versi MVP.
- **Definisi Berhasil**: Metrik keberhasilan yang teruji dan dapat diukur secara spesifik (contoh: pengguna dapat menyelesaikan alur X dalam waktu < 5 menit).

## 3. Di Luar Scope (Out of Scope untuk MVP)
Daftar minimal 4-5 fitur yang sengaja ditunda ke fase rilis berikutnya agar MVP tetap ramping dan cepat diluncurkan.

## 4. Pengguna & Skenario Penggunaan
- **Target Pengguna**: Profil persona pengguna utama.
- **Alur Utama (Happy Path)**: Urutan langkah bertahap mulai dari pertama kali pengguna masuk hingga tujuan utamanya tercapai.

## 5. Daftar Fitur
Sajikan tabel Markdown berisi 5-8 fitur utama dengan kolom berikut:
| ID | Fitur | Prioritas | Kriteria Selesai |
| :--- | :--- | :--- | :--- |
(ID menggunakan format FEAT-01, FEAT-02, dst. Prioritas: MVP atau Nanti).

## 6. Alur & Kasus Khusus
Detail penanganan skenario error, batas kuota, koneksi gagal, validasi input, atau status kosong (empty state).

## 7. Kebutuhan Teknis
- **Platform**: Web / Mobile / Desktop / PWA
- **Frontend Stack**: Framework, styling, UI components, state management
- **Backend / Database / AI Stack**: API route, database, auth, AI model/proxy
- **Penyimpanan Data MVP**: Browser storage / cloud database
- **Batasan Biaya**: Estimasi infrastruktur $0 atau free-tier

## 8. Tahapan Pengerjaan (Milestones)
Breakdown pengerjaan bertahap (Milestone 1 sampai Milestone 5-6) beserta estimasi waktu.

## 9. Asumsi & Pertanyaan Terbuka
- \`[ASUMSI]\` Asumsi teknis atau bisnis utama
- \`[PERTANYAAN TERBUKA]\` Pertanyaan yang perlu diputuskan lebih lanjut

---

# Daftar Task untuk Agent Coding

Pekerjaan dipecah menjadi task-task kecil berurutan (T1, T2, T3, dst.) yang masing-masing dapat langsung dijalankan dan diuji oleh AI coding agent:

### **T1: [Judul Inisialisasi & Setup]**
- **Tujuan**: Deskripsi ringkas tujuan task.
- **File Terlibat**:
  - \`path/to/file1\`
  - \`path/to/file2\`
- **Kriteria Selesai**:
  - Langkah verifikasi konkret yang dapat diuji.

### **T2: [Judul Fitur Inti / Data Model]**
- **Tujuan**: ...
- **File Terlibat**:
  - \`path/to/file\`
- **Kriteria Selesai**:
  - ...

(Lanjutkan urutan task secara komprehensif hingga minimal T6 - T8 mencakup seluruh fitur MVP di atas).

Aturan Tambahan:
- Berikan respon langsung dalam format Markdown tanpa teks pembuka, obrolan, atau penutup di luar PRD.
- Sesuaikan teknologi, stack, dan arsitektur persis dengan jawaban keputusan pengguna.
- Gunakan Bahasa Indonesia yang profesional, rapi, dan mudah dibaca.`;
}

/**
 * Builds user prompt for PRD generation given the idea and normalized user answers.
 */
export function buildPrdPrompt(idea: string, answersInput?: unknown): string {
  const answers = normalizeAnswers(answersInput);

  const formattedAnswers =
    answers.length > 0
      ? answers
          .map((a, index) => {
            const categoryPart = a.category ? `[${a.category}] ` : "";
            const questionPart = a.question ? `${a.question} -> ` : "";
            return `${index + 1}. ${categoryPart}${questionPart}${a.answer}`;
          })
          .join("\n")
      : "Belum ada jawaban spesifik; gunakan asumsi arsitektur modern terbaik untuk MVP (Next.js 14 App Router, Tailwind CSS, TypeScript).";

  return `Ide Produk:
"${idea}"

Keputusan Arsitektur & Jawaban Perencanaan Pengguna:
${formattedAnswers}

Silakan susun dokumen Product Requirement Document (PRD) komprehensif dan Daftar Task untuk Agent Coding sesuai dengan template standar ngePRD di atas.`;
}
