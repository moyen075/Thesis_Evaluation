"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RUBRIC_FACTORS } from "@/lib/types";

export function HumanEvaluationForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(RUBRIC_FACTORS.map((factor) => [factor.key, 0]))
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () =>
      Number(
        RUBRIC_FACTORS.reduce(
          (sum, factor) => sum + Number(scores[factor.key] ?? 0),
          0
        ).toFixed(2)
      ),
    [scores]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch(`/api/teacher/tasks/${taskId}/human-evaluation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores, notes }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Submission failed");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {RUBRIC_FACTORS.map((factor) => (
        <Card key={factor.key}>
          <CardHeader>
            <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span>{factor.label}</span>
              <span className="text-sm text-[var(--muted-foreground)]">
                / {factor.maxScore}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm text-[var(--muted-foreground)]">
              {factor.levels.map((level) => (
                <p key={level.score}>
                  <span className="font-medium text-[var(--foreground)]">
                    {level.score}:
                  </span>{" "}
                  {level.text}
                </p>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor={`${factor.key}-score`}>Score</Label>
                <input
                  id={`${factor.key}-score`}
                  type="number"
                  min={0}
                  max={factor.maxScore}
                  step="any"
                  required
                  value={scores[factor.key]}
                  onChange={(event) =>
                    setScores({
                      ...scores,
                      [factor.key]: Number(event.target.value),
                    })
                  }
                  className="h-10 w-full rounded-md border bg-white px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${factor.key}-notes`}>Notes</Label>
                <Textarea
                  id={`${factor.key}-notes`}
                  rows={2}
                  value={notes[factor.key] ?? ""}
                  onChange={(event) =>
                    setNotes({ ...notes, [factor.key]: event.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 flex items-center justify-between rounded-md border bg-white p-3 shadow-sm">
        <p className="font-semibold">Total: {total} / 10</p>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Submit Phase 1
        </Button>
      </div>
    </form>
  );
}

