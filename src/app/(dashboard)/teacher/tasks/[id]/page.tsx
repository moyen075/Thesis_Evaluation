import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

  const { data: humanEvaluation } = await admin
    .from("human_evaluations")
    .select("*")
    .eq("task_id", id)
    .maybeSingle();

  const { data: humanFactors } = humanEvaluation
    ? await admin
        .from("human_factor_scores")
        .select("*")
        .eq("human_evaluation_id", humanEvaluation.id)
    : { data: [] };

  const canSeeAi = Boolean(humanEvaluation);

  const { data: aiEvaluations } = canSeeAi
    ? await admin
        .from("ai_evaluations")
        .select("*")
        .eq("paragraph_id", paragraph.id)
        .order("agent")
    : { data: [] };

  const aiEvaluationIds = (aiEvaluations ?? []).map((evaluation) => evaluation.id);

  const { data: aiFactors } =
    aiEvaluationIds.length > 0
      ? await admin
          .from("ai_factor_scores")
          .select("*")
          .in("ai_evaluation_id", aiEvaluationIds)
      : { data: [] };

  const { data: reviews } =
    aiEvaluationIds.length > 0
      ? await admin
          .from("ai_review_answers")
          .select("*")
          .eq("task_id", id)
          .in("ai_evaluation_id", aiEvaluationIds)
      : { data: [] };

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
        <Badge>{task.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Paragraph</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="prose-paragraph text-sm">{paragraph.paragraph_text}</p>
        </CardContent>
      </Card>

      {!canSeeAi ? (
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
        </section>
      )}
    </div>
  );
}
