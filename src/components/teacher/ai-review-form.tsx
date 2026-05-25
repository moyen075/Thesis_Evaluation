"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FACTOR_OPTIONS, RUBRIC_FACTORS, type AIAgent, type FactorKey } from "@/lib/types";

interface FactorScore {
  factor_key: FactorKey;
  factor_label: string;
  score: number;
  max_score: number;
  reason?: string;
  notes?: string | null;
}

interface AIReviewFormProps {
  taskId: string;
  evaluation: {
    id: string;
    agent: AIAgent;
    total_score: number;
    raw_feedback: string;
    factors: FactorScore[];
  };
  humanFactors: FactorScore[];
  alreadySubmitted: boolean;
}

export function AIReviewForm({
  taskId,
  evaluation,
  humanFactors,
  alreadySubmitted,
}: AIReviewFormProps) {
  const router = useRouter();
  const [analyticalAnswers, setAnalyticalAnswers] = useState<Record<string, string>>({});
  const [actionabilityScore, setActionabilityScore] = useState(0);
  const [toneRegisterScore, setToneRegisterScore] = useState(0);
  const [hallucinatedErrors, setHallucinatedErrors] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const humanByFactor = new Map(
    humanFactors.map((factor) => [factor.factor_key, Number(factor.score)])
  );
  const aiByFactor = new Map(
    evaluation.factors.map((factor) => [factor.factor_key, Number(factor.score)])
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch(`/api/teacher/tasks/${taskId}/ai-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiEvaluationId: evaluation.id,
        analyticalAnswers,
        actionabilityScore,
        toneRegisterScore,
        hallucinatedErrors: hallucinatedErrors === "yes",
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Review failed");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{evaluation.agent}</span>
          <span>{evaluation.total_score} / 10</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-[var(--muted)] p-3">
            <h3 className="mb-2 text-sm font-semibold">Score Breakdown</h3>
            <div className="space-y-2 text-sm">
              {evaluation.factors.map((factor) => (
                <p key={factor.factor_key}>
                  <span className="font-medium">{factor.factor_label}:</span>{" "}
                  {factor.score} / {factor.max_score}
                  {factor.reason && (
                    <span className="block text-[var(--muted-foreground)]">
                      {factor.reason}
                    </span>
                  )}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold">Full AI Feedback</h3>
            <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {evaluation.raw_feedback}
            </p>
          </div>
        </div>

        {alreadySubmitted ? (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Review submitted
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              <h3 className="font-semibold">Part A</h3>
              {RUBRIC_FACTORS.map((factor, index) => {
                const humanScore = humanByFactor.get(factor.key) ?? 0;
                const aiScore = aiByFactor.get(factor.key) ?? 0;
                const exact = humanScore === aiScore;

                return (
                  <div key={factor.key} className="rounded-md border bg-white p-3">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">
                        Factor {index + 1}: {factor.label}
                      </p>
                      <Badge>
                        Human {humanScore} / {factor.maxScore} vs AI {aiScore} / {factor.maxScore}
                      </Badge>
                    </div>
                    {exact ? (
                      <Badge className="border-green-200 bg-green-50 text-green-700">
                        Exact Match
                      </Badge>
                    ) : (
                      <fieldset className="space-y-2">
                        <legend className="mb-2 text-sm text-[var(--muted-foreground)]">
                          Your initial score was {humanScore}, and the AI score is {aiScore}. Having read the AI analysis, how do you view this difference?
                        </legend>
                        {Object.entries(FACTOR_OPTIONS).map(([value, label]) => (
                          <label
                            key={value}
                            className="flex gap-2 rounded-md border p-2 text-sm"
                          >
                            <input
                              type="radio"
                              name={`${evaluation.id}-${factor.key}`}
                              required
                              value={value}
                              onChange={() =>
                                setAnalyticalAnswers({
                                  ...analyticalAnswers,
                                  [factor.key]: value,
                                })
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Option 3 applies when the AI justification is logical and falls within a reasonable alternative professional judgment.
                        </p>
                      </fieldset>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Part B</h3>
              <RatingSelect
                id={`${evaluation.id}-actionability`}
                label="Q5. Overall actionability"
                value={actionabilityScore}
                onChange={setActionabilityScore}
                options={[
                  "Not actionable",
                  "Slightly actionable",
                  "Moderately actionable",
                  "Actionable",
                  "Highly actionable",
                ]}
              />
              <RatingSelect
                id={`${evaluation.id}-tone`}
                label="Q6. Tone & register"
                value={toneRegisterScore}
                onChange={setToneRegisterScore}
                options={[
                  "Inappropriate / Highly Robotic",
                  "Marginally Acceptable",
                  "Neutral / Passable",
                  "Encouraging and Professional",
                  "Pedagogically Sound / Human-like",
                ]}
              />
              <fieldset className="rounded-md border bg-white p-3">
                <legend className="px-1 text-sm font-medium">
                  Q7. Technical reliability
                </legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${evaluation.id}-hallucination`}
                      required
                      value="yes"
                      onChange={(event) => setHallucinatedErrors(event.target.value)}
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${evaluation.id}-hallucination`}
                      required
                      value="no"
                      onChange={(event) => setHallucinatedErrors(event.target.value)}
                    />
                    No
                  </label>
                </div>
              </fieldset>
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || actionabilityScore === 0 || toneRegisterScore === 0}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Submit {evaluation.agent} review
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function RatingSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2 rounded-md border bg-white p-3">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        required
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-md border bg-white px-3"
      >
        <option value={0}>Select rating</option>
        {options.map((option, index) => (
          <option key={option} value={index + 1}>
            {index + 1} - {option}
          </option>
        ))}
      </select>
    </div>
  );
}

