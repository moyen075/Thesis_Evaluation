import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock3, Lock } from "lucide-react";
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

  const activeTasks = tasks ?? [];
  const phase1CompleteCount = activeTasks.filter((task) =>
    hasPhase1Complete(task.status)
  ).length;
  const phase1Total = activeTasks.length;
  const phase1Remaining = phase1Total - phase1CompleteCount;
  const phase2Unlocked = phase1Total > 0 && phase1Remaining === 0;
  const progressPercent =
    phase1Total > 0 ? Math.round((phase1CompleteCount / phase1Total) * 100) : 0;

  return (
    <div className="space-y-5 pb-16 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold">Assigned Tasks</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Complete Phase 1 for every task before reviewing AI feedback
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border bg-[var(--muted)]">
              {phase2Unlocked ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
              ) : (
                <Lock className="h-5 w-5 text-[var(--muted-foreground)]" />
              )}
            </span>
            <div>
              <p className="font-semibold">
                Phase 1: {phase1CompleteCount} / {phase1Total} complete
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {phase2Unlocked
                  ? "Phase 2 AI review is available for submitted tasks."
                  : phase1Total > 0
                    ? `${phase1Remaining} Phase 1 ${phase1Remaining === 1 ? "task" : "tasks"} remaining before Phase 2 unlocks.`
                    : "No active tasks assigned."}
              </p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)] sm:w-56">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activeTasks.map((task) => {
          const paragraph = task.paragraphs as unknown as
            | { paragraph_id: string }
            | null;
          return (
            <Link key={task.id} href={`/teacher/tasks/${task.id}`}>
              <Card className="h-full transition hover:border-[var(--primary)]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{paragraph?.paragraph_id ?? "Paragraph"}</span>
                    <StatusBadge status={task.status} phase2Unlocked={phase2Unlocked} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    {task.status === "PHASE_2_COMPLETE" ? (
                      <ClipboardCheck className="h-4 w-4" />
                    ) : hasPhase1Complete(task.status) ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Clock3 className="h-4 w-4" />
                    )}
                    {new Date(task.assigned_at).toLocaleString()}
                  </div>
                  {hasPhase1Complete(task.status) && !phase2Unlocked && (
                    <p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <Lock className="h-3.5 w-3.5" />
                      Phase 2 unlocks after all Phase 1 tasks are submitted
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {activeTasks.length === 0 && (
        <div className="rounded-md border bg-white p-6 text-center text-sm text-[var(--muted-foreground)]">
          No tasks assigned
        </div>
      )}
    </div>
  );
}

function hasPhase1Complete(status: string) {
  return status === "PHASE_1_COMPLETE" || status === "PHASE_2_COMPLETE";
}

function StatusBadge({
  status,
  phase2Unlocked,
}: {
  status: string;
  phase2Unlocked: boolean;
}) {
  const label =
    status === "NOT_STARTED"
      ? "Phase 1"
      : status === "PHASE_1_COMPLETE"
        ? phase2Unlocked
          ? "AI Review"
          : "Phase 1 done"
        : status === "PHASE_2_COMPLETE"
          ? "Complete"
          : status;

  return <Badge>{label}</Badge>;
}
