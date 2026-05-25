import Link from "next/link";
import { ClipboardCheck, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TeacherTasksPage() {
  const { user } = await requireRole(["TEACHER"]);
  const admin = createAdminClient();

  const { data: tasks } = await admin
    .from("teacher_tasks")
    .select("id,status,assigned_at,paragraphs(paragraph_id)")
    .eq("teacher_id", user.id)
    .neq("status", "ARCHIVED")
    .order("assigned_at", { ascending: true });

  return (
    <div className="space-y-5 pb-16 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold">Assigned Tasks</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Complete Phase 1 before reviewing AI feedback
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(tasks ?? []).map((task) => {
          const paragraph = task.paragraphs as unknown as
            | { paragraph_id: string }
            | null;
          return (
            <Link key={task.id} href={`/teacher/tasks/${task.id}`}>
              <Card className="h-full transition hover:border-[var(--primary)]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{paragraph?.paragraph_id ?? "Paragraph"}</span>
                    <StatusBadge status={task.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    {task.status === "PHASE_2_COMPLETE" ? (
                      <ClipboardCheck className="h-4 w-4" />
                    ) : (
                      <Clock3 className="h-4 w-4" />
                    )}
                    {new Date(task.assigned_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {(tasks ?? []).length === 0 && (
        <div className="rounded-md border bg-white p-6 text-center text-sm text-[var(--muted-foreground)]">
          No tasks assigned
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "NOT_STARTED"
      ? "Phase 1"
      : status === "PHASE_1_COMPLETE"
        ? "AI Review"
        : status === "PHASE_2_COMPLETE"
          ? "Complete"
          : status;

  return <Badge>{label}</Badge>;
}
