import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api";
import { RUBRIC_FACTORS } from "@/lib/types";
import { aiReviewSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(["TEACHER"]);
  if (session.error) return session.error;

  const { id } = await context.params;
  const parsed = aiReviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: task, error: taskError } = await session.admin
    .from("teacher_tasks")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", session.user.id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!["PHASE_1_COMPLETE", "PHASE_2_COMPLETE"].includes(task.status)) {
    return NextResponse.json(
      { error: "Submit Phase 1 before reviewing AI feedback." },
      { status: 409 }
    );
  }

  const { data: aiEvaluation, error: aiError } = await session.admin
    .from("ai_evaluations")
    .select("*")
    .eq("id", parsed.data.aiEvaluationId)
    .eq("paragraph_id", task.paragraph_id)
    .single();

  if (aiError || !aiEvaluation) {
    return NextResponse.json({ error: "AI evaluation not found" }, { status: 404 });
  }

  const { data: humanEvaluation } = await session.admin
    .from("human_evaluations")
    .select("id")
    .eq("task_id", id)
    .single();

  if (!humanEvaluation) {
    return NextResponse.json(
      { error: "Human evaluation is required before AI review." },
      { status: 409 }
    );
  }

  const [{ data: humanFactors }, { data: aiFactors }] = await Promise.all([
    session.admin
      .from("human_factor_scores")
      .select("*")
      .eq("human_evaluation_id", humanEvaluation.id),
    session.admin
      .from("ai_factor_scores")
      .select("*")
      .eq("ai_evaluation_id", aiEvaluation.id),
  ]);

  const humanByFactor = new Map(
    (humanFactors ?? []).map((factor) => [factor.factor_key, Number(factor.score)])
  );
  const aiByFactor = new Map(
    (aiFactors ?? []).map((factor) => [factor.factor_key, Number(factor.score)])
  );
  const analyticalAnswers: Record<string, string> = {};

  for (const factor of RUBRIC_FACTORS) {
    const humanScore = humanByFactor.get(factor.key);
    const aiScore = aiByFactor.get(factor.key);

    if (humanScore === undefined || aiScore === undefined) {
      return NextResponse.json(
        { error: `Missing score data for ${factor.label}` },
        { status: 500 }
      );
    }

    if (humanScore === aiScore) {
      analyticalAnswers[factor.key] = "Exact Match";
      continue;
    }

    const answer = parsed.data.analyticalAnswers[factor.key];
    if (
      !["ai_more_accurate", "human_more_accurate", "both_acceptable"].includes(
        String(answer)
      )
    ) {
      return NextResponse.json(
        { error: `Part A answer is required for ${factor.label}` },
        { status: 400 }
      );
    }

    analyticalAnswers[factor.key] = answer;
  }

  const { data: existingReview } = await session.admin
    .from("ai_review_answers")
    .select("id")
    .eq("task_id", id)
    .eq("ai_evaluation_id", aiEvaluation.id)
    .maybeSingle();

  if (existingReview) {
    return NextResponse.json(
      { error: "This AI review has already been submitted." },
      { status: 409 }
    );
  }

  const { error: insertError } = await session.admin
    .from("ai_review_answers")
    .insert({
      task_id: id,
      ai_evaluation_id: aiEvaluation.id,
      agent: aiEvaluation.agent,
      analytical_answers: analyticalAnswers,
      actionability_score: parsed.data.actionabilityScore,
      tone_register_score: parsed.data.toneRegisterScore,
      hallucinated_errors: parsed.data.hallucinatedErrors,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { count } = await session.admin
    .from("ai_review_answers")
    .select("id", { count: "exact", head: true })
    .eq("task_id", id);

  if ((count ?? 0) >= 2) {
    await session.admin
      .from("teacher_tasks")
      .update({
        status: "PHASE_2_COMPLETE",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return NextResponse.json({ analyticalAnswers }, { status: 201 });
}

