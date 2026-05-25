import { requireRole } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ParagraphsView } from "@/components/admin/paragraphs-view";

export const dynamic = "force-dynamic";

export default async function ParagraphsPage() {
  await requireRole(["ADMIN"]);
  const admin = createAdminClient();

  const [{ data: paragraphs }, { data: aiEvaluations }, { data: aiFactors }] =
    await Promise.all([
      admin
        .from("paragraphs")
        .select("id,paragraph_id,paragraph_text,legacy_initial_score")
        .order("paragraph_id"),
      admin
        .from("ai_evaluations")
        .select("id,paragraph_id,agent,total_score,corrective_feedback,improvement_feedback"),
      admin
        .from("ai_factor_scores")
        .select("id,ai_evaluation_id,factor_key,factor_label,score,max_score,reason"),
    ]);

  type Factor = NonNullable<typeof aiFactors>[number];
  type EvaluationWithFactors = NonNullable<typeof aiEvaluations>[number] & { factors: Factor[] };

  const factorsByEval = new Map<string, Factor[]>();
  for (const factor of aiFactors ?? []) {
    const list = factorsByEval.get(factor.ai_evaluation_id) ?? [];
    list.push(factor);
    factorsByEval.set(factor.ai_evaluation_id, list);
  }

  const evalsByParagraph = new Map<string, EvaluationWithFactors[]>();
  for (const evaluation of aiEvaluations ?? []) {
    const list = evalsByParagraph.get(evaluation.paragraph_id) ?? [];
    list.push({ ...evaluation, factors: factorsByEval.get(evaluation.id) ?? [] });
    evalsByParagraph.set(evaluation.paragraph_id, list);
  }

  const data = (paragraphs ?? []).map((paragraph) => ({
    ...paragraph,
    evaluations: evalsByParagraph.get(paragraph.id) ?? [],
  }));

  return <ParagraphsView paragraphs={data} />;
}
