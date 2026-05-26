import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Lock } from "lucide-react";
import Link from "next/link";
import { AIReviewForm } from "@/components/teacher/ai-review-form";
import { HumanEvaluationForm } from "@/components/teacher/human-evaluation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { RUBRIC_FACTORS, type AIAgent, type FactorKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeacherTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireRole(["TEACHER"]);
  const admin = createAdminClient();

  const { data: task } = await admin
    .from("teacher_tasks")
    .select("*, paragraphs(*)")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!task) {
    notFound();
  }

  const paragraph = task.paragraphs as unknown as {
    id: string;
    paragraph_id: string;
    paragraph_text: string;
  } | null;

  if (!paragraph) {
    notFound();
  }

  const [{ data: humanEvaluation }, { data: teacherTasks }] = await Promise.all([
    admin.from("human_evaluations").select("*").eq("task_id", id).maybeSingle(),
    admin
      .from("teacher_tasks")
      .select("id,status")
      .eq("teacher_id", user.id)
      .neq("status", "ARCHIVED"),
  ]);

  const activeTeacherTasks = teacherTasks ?? [];
  const phase1CompleteCount = activeTeacherTasks.filter((item) =>
    hasPhase1Complete(item.status)
  ).length;
  const phase1Total = activeTeacherTasks.length;
  const phase1Remaining = phase1Total - phase1CompleteCount;
  const allPhase1Complete = phase1Total > 0 && phase1Remaining === 0;
  const currentPhase1Complete = Boolean(humanEvaluation);
  const canSeeAi = currentPhase1Complete && allPhase1Complete;
  const progressPercent =
    phase1Total > 0 ? Math.round((phase1CompleteCount / phase1Total) * 100) : 0;

  const [{ data: humanFactors }, { data: aiEvaluations }] = await Promise.all([
    humanEvaluation
      ? admin.from("human_factor_scores").select("*").eq("human_evaluation_id", humanEvaluation.id)
      : Promise.resolve({ data: [] }),
    canSeeAi
      ? admin.from("ai_evaluations").select("*").eq("paragraph_id", paragraph.id).order("agent")
      : Promise.resolve({ data: [] }),
  ]);

  const aiEvaluationIds = (aiEvaluations ?? []).map((evaluation) => evaluation.id);

  const [{ data: aiFactors }, { data: reviews }] = await Promise.all([
    canSeeAi && aiEvaluationIds.length > 0
      ? admin.from("ai_factor_scores").select("*").in("ai_evaluation_id", aiEvaluationIds)
      : Promise.resolve({ data: [] }),
    canSeeAi && aiEvaluationIds.length > 0
      ? admin.from("ai_review_answers").select("*").eq("task_id", id).in("ai_evaluation_id", aiEvaluationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const factorsByAi = new Map<string, Array<{
    factor_key: FactorKey;
    factor_label: string;
    score: number;
    max_score: number;
    reason: string;
  }>>();

  for (const factor of aiFactors ?? []) {
    const list = factorsByAi.get(factor.ai_evaluation_id) ?? [];
    list.push({
      factor_key: factor.factor_key,
      factor_label: factor.factor_label,
      score: Number(factor.score),
      max_score: Number(factor.max_score),
      reason: factor.reason,
    });
    factorsByAi.set(factor.ai_evaluation_id, list);
  }

  const submittedReviewIds = new Set(
    (reviews ?? []).map((review) => review.ai_evaluation_id)
  );

  return (
    <div className="space-y-5 pb-16 md:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/teacher/tasks"
            className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Tasks
          </Link>
          <h1 className="text-2xl font-semibold">{paragraph.paragraph_id}</h1>
        </div>
        <StatusBadge status={task.status} phase2Unlocked={allPhase1Complete} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Paragraph</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="prose-paragraph text-sm">{paragraph.paragraph_text}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border bg-[var(--muted)]">
              {allPhase1Complete ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
              ) : (
                <Clock3 className="h-5 w-5 text-[var(--muted-foreground)]" />
              )}
            </span>
            <div>
              <p className="font-semibold">
                Phase 1: {phase1CompleteCount} / {phase1Total} complete
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {allPhase1Complete
                  ? "All assigned Phase 1 evaluations are submitted."
                  : `${phase1Remaining} Phase 1 ${phase1Remaining === 1 ? "task" : "tasks"} remaining before Phase 2 unlocks.`}
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

      {!currentPhase1Complete ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Phase 1: Human Evaluation</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Rubric score total: 10
            </p>
          </div>
          <HumanEvaluationForm taskId={id} />
        </section>
      ) : (
        <section className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Phase 1 Submitted</span>
                <span>{humanEvaluation.total_score} / 10</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {(humanFactors ?? []).map((factor) => {
                  const rubric = RUBRIC_FACTORS.find(
                    (item) => item.key === factor.factor_key
                  );
                  return (
                    <div key={factor.id} className="rounded-md border bg-white p-3 text-sm">
                      <p className="font-medium">{rubric?.label ?? factor.factor_key}</p>
                      <p>
                        {factor.score} / {factor.max_score}
                      </p>
                      {factor.notes && (
                        <p className="mt-1 text-[var(--muted-foreground)]">
                          {factor.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {canSeeAi ? (
            <>
              <div>
                <h2 className="text-xl font-semibold">Phase 2: AI Review</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Gemini and Llama are reviewed separately
                </p>
              </div>

              <div className="space-y-5">
                {(aiEvaluations ?? []).map((evaluation) => (
                  <AIReviewForm
                    key={evaluation.id}
                    taskId={id}
                    evaluation={{
                      id: evaluation.id,
                      agent: evaluation.agent as AIAgent,
                      total_score: Number(evaluation.total_score),
                      raw_feedback: evaluation.raw_feedback,
                      factors: factorsByAi.get(evaluation.id) ?? [],
                    }}
                    humanFactors={(humanFactors ?? []).map((factor) => ({
                      factor_key: factor.factor_key,
                      factor_label:
                        RUBRIC_FACTORS.find((item) => item.key === factor.factor_key)
                          ?.label ?? factor.factor_key,
                      score: Number(factor.score),
                      max_score: Number(factor.max_score),
                      notes: factor.notes,
                    }))}
                    alreadySubmitted={submittedReviewIds.has(evaluation.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[var(--muted-foreground)]" />
                  Phase 2 Locked
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Complete Phase 1 for every assigned task before reviewing Gemini and Llama feedback.
                </p>
                <div className="rounded-md border bg-[var(--muted)] p-3 text-sm">
                  {phase1Remaining} Phase 1 {phase1Remaining === 1 ? "task is" : "tasks are"} still remaining.
                </div>
                <Link
                  href="/teacher/tasks"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to tasks
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
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
