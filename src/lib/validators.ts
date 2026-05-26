import { z } from "zod";
import { RUBRIC_FACTORS } from "@/lib/types";

const factorShape = Object.fromEntries(
  RUBRIC_FACTORS.map((factor) => [
    factor.key,
    z.number().min(0).max(factor.maxScore),
  ])
) as Record<(typeof RUBRIC_FACTORS)[number]["key"], z.ZodNumber>;

const noteShape = Object.fromEntries(
  RUBRIC_FACTORS.map((factor) => [factor.key, z.string().optional()])
) as Record<(typeof RUBRIC_FACTORS)[number]["key"], z.ZodOptional<z.ZodString>>;

export const teacherCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
});

export const manualAssignmentSchema = z.object({
  paragraphId: z.string().uuid(),
  teacherIds: z.array(z.string().uuid()).length(2),
});

export const humanEvaluationSchema = z.object({
  scores: z.object(factorShape),
  notes: z.object(noteShape).optional(),
});

const analyticalValueSchema = z.union([
  z.literal("Exact Match"),
  z.literal("ai_more_accurate"),
  z.literal("human_more_accurate"),
  z.literal("both_acceptable"),
]);

export const aiReviewSchema = z.object({
  aiEvaluationId: z.string().uuid(),
  analyticalAnswers: z.record(z.string(), analyticalValueSchema),
  actionabilityScore: z.number().int().min(1).max(5),
  toneRegisterScore: z.number().int().min(1).max(5),
  hallucinatedErrors: z.boolean(),
});

