import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole(["ADMIN", "TEACHER"]);

  return (
    <AppShell role={profile.role} name={profile.full_name}>
      {children}
    </AppShell>
  );
}

