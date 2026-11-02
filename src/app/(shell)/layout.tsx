import React from "react";
import ShellLayout from "@/components/dashboard/ShellLayout";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellLayout>{children}</ShellLayout>;
}
