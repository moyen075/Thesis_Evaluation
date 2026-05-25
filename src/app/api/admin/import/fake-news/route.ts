import path from "node:path";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api";
import {
  parseFakeNewsDirectory,
  summarizeParsedDataset,
} from "@/lib/data/fake-news-parser";

export const runtime = "nodejs";

export async function POST() {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const directory =
    process.env.FAKE_NEWS_DIR || path.resolve(process.cwd(), "..", "Fake_News");
  const records = parseFakeNewsDirectory(directory);
  const summary = summarizeParsedDataset(records);

  for (const record of records) {
    const { data: paragraph, error: paragraphError } = await session.admin
      .from("paragraphs")
      .upsert(
        {
          paragraph_id: record.paragraphId,
          paragraph_text: record.paragraphText,
          legacy_initial_score: record.legacyInitialScore,
          raw_yaml: record.rawYaml,
        },
        { onConflict: "paragraph_id" }
      )
      .select("id")
      .single();

    if (paragraphError || !paragraph) {
      return NextResponse.json(
        { error: paragraphError?.message ?? "Paragraph import failed" },
        { status: 500 }
      );
    }

    for (const evaluation of record.aiEvaluations) {
      const { data: aiEvaluation, error: evaluationError } = await session.admin
        .from("ai_evaluations")
        .upsert(
          {
            paragraph_id: paragraph.id,
            agent: evaluation.agent,
            total_score: evaluation.totalScore,
            raw_feedback: evaluation.rawFeedback,
            corrective_feedback: evaluation.correctiveFeedback,
            improvement_feedback: evaluation.improvementFeedback,
            parse_warnings: evaluation.warnings,
          },
          { onConflict: "paragraph_id,agent" }
        )
        .select("id")
        .single();

      if (evaluationError || !aiEvaluation) {
        return NextResponse.json(
          { error: evaluationError?.message ?? "AI evaluation import failed" },
          { status: 500 }
        );
      }

      const { error: deleteError } = await session.admin
        .from("ai_factor_scores")
        .delete()
        .eq("ai_evaluation_id", aiEvaluation.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      const { error: factorError } = await session.admin
        .from("ai_factor_scores")
        .insert(
          evaluation.factors.map((factor) => ({
            ai_evaluation_id: aiEvaluation.id,
            factor_key: factor.factorKey,
            factor_label: factor.factorLabel,
            score: factor.score,
            max_score: factor.maxScore,
            reason: factor.reason,
          }))
        );

      if (factorError) {
        return NextResponse.json({ error: factorError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ directory, ...summary });
}

