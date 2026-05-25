import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getApiSession } from "@/lib/api";

export async function GET(request: NextRequest) {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";

  const [
    { data: tasks, error: taskError },
    { data: humanEvaluations, error: humanError },
    { data: humanFactors, error: humanFactorError },
    { data: aiEvaluations, error: aiError },
    { data: aiFactors, error: aiFactorError },
    { data: reviews, error: reviewError },
  ] = await Promise.all([
    session.admin
      .from("teacher_tasks")
      .select("*, paragraphs(paragraph_id,paragraph_text), profiles!teacher_tasks_teacher_id_fkey(full_name,email)")
      .order("assigned_at", { ascending: true }),
    session.admin.from("human_evaluations").select("*"),
    session.admin.from("human_factor_scores").select("*"),
    session.admin.from("ai_evaluations").select("*"),
    session.admin.from("ai_factor_scores").select("*"),
    session.admin.from("ai_review_answers").select("*"),
  ]);

  const error =
    taskError || humanError || humanFactorError || aiError || aiFactorError || reviewError;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const humanByTask = new Map((humanEvaluations ?? []).map((item) => [item.task_id, item]));
  const humanFactorsByHuman = new Map();
  for (const item of humanFactors ?? []) {
    const list = humanFactorsByHuman.get(item.human_evaluation_id) ?? [];
    list.push(item);
    humanFactorsByHuman.set(item.human_evaluation_id, list);
  }

  const aiByParagraph = new Map();
  for (const item of aiEvaluations ?? []) {
    const list = aiByParagraph.get(item.paragraph_id) ?? [];
    list.push(item);
    aiByParagraph.set(item.paragraph_id, list);
  }

  const aiFactorsByEval = new Map();
  for (const item of aiFactors ?? []) {
    const list = aiFactorsByEval.get(item.ai_evaluation_id) ?? [];
    list.push(item);
    aiFactorsByEval.set(item.ai_evaluation_id, list);
  }

  const reviewsByTaskEval = new Map(
    (reviews ?? []).map((item) => [`${item.task_id}:${item.ai_evaluation_id}`, item])
  );

  const rows = [];

  for (const task of tasks ?? []) {
    const human = humanByTask.get(task.id);
    const humanFactorRows = human ? humanFactorsByHuman.get(human.id) ?? [] : [];
    const paragraph = task.paragraphs;
    const teacher = task.profiles;

    for (const aiEvaluation of aiByParagraph.get(task.paragraph_id) ?? []) {
      const review = reviewsByTaskEval.get(`${task.id}:${aiEvaluation.id}`);
      rows.push({
        task_id: task.id,
        paragraph_id: paragraph?.paragraph_id ?? "",
        teacher_id: task.teacher_id,
        teacher_name: teacher?.full_name ?? "",
        teacher_email: teacher?.email ?? "",
        task_status: task.status,
        human_total_score: human?.total_score ?? "",
        human_factors: JSON.stringify(humanFactorRows),
        ai_agent: aiEvaluation.agent,
        ai_total_score: aiEvaluation.total_score,
        ai_factors: JSON.stringify(aiFactorsByEval.get(aiEvaluation.id) ?? []),
        analytical_answers: JSON.stringify(review?.analytical_answers ?? {}),
        actionability_score: review?.actionability_score ?? "",
        tone_register_score: review?.tone_register_score ?? "",
        hallucinated_errors: review?.hallucinated_errors ?? "",
        assigned_at: task.assigned_at,
        phase1_submitted_at: human?.submitted_at ?? "",
        ai_review_submitted_at: review?.submitted_at ?? "",
      });
    }
  }

  if (format === "json") {
    return NextResponse.json(rows);
  }

  return new NextResponse(Papa.unparse(rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="thesis_evaluation_export.csv"',
    },
  });
}

