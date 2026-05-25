import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  parseFakeNewsDirectory,
  summarizeParsedDataset,
} from "../src/lib/data/fake-news-parser.js";
import { loadEnv } from "./env.mjs";

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const directory =
  process.env.FAKE_NEWS_DIR || path.resolve(process.cwd(), "..", "Fake_News");

if (!url || !serviceKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Delete in dependency order to respect foreign key constraints
console.log("Clearing existing data...");
for (const table of [
  "ai_review_answers",
  "human_factor_scores",
  "human_evaluations",
  "teacher_tasks",
  "ai_factor_scores",
  "ai_evaluations",
  "paragraphs",
]) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
  console.log(`  cleared ${table}`);
}

// Re-import from YAML files
console.log(`\nImporting from ${directory}...`);
const records = parseFakeNewsDirectory(directory);
const summary = summarizeParsedDataset(records);

for (const record of records) {
  const { data: paragraph, error: paragraphError } = await supabase
    .from("paragraphs")
    .insert({
      paragraph_id: record.paragraphId,
      paragraph_text: record.paragraphText,
      legacy_initial_score: record.legacyInitialScore,
      raw_yaml: record.rawYaml,
    })
    .select("id")
    .single();

  if (paragraphError) throw paragraphError;

  for (const evaluation of record.aiEvaluations) {
    const { data: aiEvaluation, error: evaluationError } = await supabase
      .from("ai_evaluations")
      .insert({
        paragraph_id: paragraph.id,
        agent: evaluation.agent,
        total_score: evaluation.totalScore,
        raw_feedback: evaluation.rawFeedback,
        corrective_feedback: evaluation.correctiveFeedback,
        improvement_feedback: evaluation.improvementFeedback,
        parse_warnings: evaluation.warnings,
      })
      .select("id")
      .single();

    if (evaluationError) throw evaluationError;

    const { error: factorError } = await supabase
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

    if (factorError) throw factorError;
  }

  console.log(`  imported ${record.paragraphId}`);
}

console.log("\nDone.");
console.log(JSON.stringify({ directory, ...summary }, null, 2));
