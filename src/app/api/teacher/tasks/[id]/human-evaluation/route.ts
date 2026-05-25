import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api";
import { RUBRIC_FACTORS } from "@/lib/types";
import { humanEvaluationSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(["TEACHER"]);
  if (session.error) return session.error;

  const { id } = await context.params;
  const parsed = humanEvaluationSchema.safeParse(await request.json());
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

  if (task.status !== "NOT_STARTED") {
    return NextResponse.json(
      { error: "Phase 1 has already been submitted for this task." },
      { status: 409 }
    );
  }

  const totalScore = Number(
    RUBRIC_FACTORS.reduce(
      (total, factor) => total + parsed.data.scores[factor.key],
      0
    ).toFixed(2)
  );

  const { data: humanEvaluation, error: humanError } = await session.admin
    .from("human_evaluations")
    .insert({
      task_id: id,
      total_score: totalScore,
    })
    .select("id")
    .single();

  if (humanError || !humanEvaluation) {
    return NextResponse.json(
      { error: humanError?.message ?? "Human evaluation save failed" },
      { status: 500 }
    );
  }

  const { error: factorError } = await session.admin
    .from("human_factor_scores")
    .insert(
      RUBRIC_FACTORS.map((factor) => ({
        human_evaluation_id: humanEvaluation.id,
        factor_key: factor.key,
        score: parsed.data.scores[factor.key],
        max_score: factor.maxScore,
        notes: parsed.data.notes?.[factor.key] || null,
      }))
    );

  if (factorError) {
    return NextResponse.json({ error: factorError.message }, { status: 500 });
  }

  const { error: updateError } = await session.admin
    .from("teacher_tasks")
    .update({
      status: "PHASE_1_COMPLETE",
      started_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ totalScore }, { status: 201 });
}

