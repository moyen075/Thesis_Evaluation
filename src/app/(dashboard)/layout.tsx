import { AppShell } from "@/components/layout/app-shell";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, user } = await requireRole(["ADMIN", "TEACHER"]);
  const admin = createAdminClient();
  const teacherTasks =
    profile.role === "TEACHER"
      ? await admin
          .from("teacher_tasks")
          .select("id,status,assigned_at,paragraphs(paragraph_id)")
          .eq("teacher_id", user.id)
          .neq("status", "ARCHIVED")
          .order("assigned_at", { ascending: true })
      : { data: [] };

  const sidebarTasks = (teacherTasks.data ?? []).map((task) => {
    const paragraph = task.paragraphs as unknown as
      | { paragraph_id: string }
      | null;

    return {
      id: task.id,
      status: task.status,
      paragraphId: paragraph?.paragraph_id ?? "Paragraph",
    };
  });

  return (
    <AppShell
      role={profile.role}
      name={profile.full_name}
      teacherTasks={sidebarTasks}
    >
      {children}
    </AppShell>
  );
}
