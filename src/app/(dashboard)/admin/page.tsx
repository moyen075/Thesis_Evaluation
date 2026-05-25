import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireRole } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole(["ADMIN"]);
  const admin = createAdminClient();

  const [
    { data: teachers },
    { data: paragraphs },
    { data: tasks },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id,email,full_name")
      .eq("role", "TEACHER")
      .order("full_name"),
    admin.from("paragraphs").select("id,paragraph_id").order("paragraph_id"),
    admin
      .from("teacher_tasks")
      .select("id,paragraph_id,teacher_id,status")
      .neq("status", "ARCHIVED"),
  ]);

  const tasksByParagraph = new Map<string, Array<{ teacher_id: string; status: string }>>();

  for (const task of tasks ?? []) {
    const list = tasksByParagraph.get(task.paragraph_id) ?? [];
    list.push({ teacher_id: task.teacher_id, status: task.status });
    tasksByParagraph.set(task.paragraph_id, list);
  }

  const assignments = (paragraphs ?? []).map((paragraph) => {
    const paragraphTasks = tasksByParagraph.get(paragraph.id) ?? [];
    return {
      id: paragraph.id,
      paragraphId: paragraph.paragraph_id,
      teacherIds: paragraphTasks.map((task) => task.teacher_id),
      locked: paragraphTasks.some((task) => task.status !== "NOT_STARTED"),
    };
  });

  return (
    <AdminDashboard
      stats={{
        teachers: teachers?.length ?? 0,
        paragraphs: paragraphs?.length ?? 0,
        activeTasks: tasks?.length ?? 0,
        completedTasks:
          tasks?.filter((task) => task.status === "PHASE_2_COMPLETE").length ?? 0,
      }}
      teachers={teachers ?? []}
      assignments={assignments}
    />
  );
}

