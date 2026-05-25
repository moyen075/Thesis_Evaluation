"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FACTOR_ORDER = [
  "content_relevance",
  "organization_cohesion",
  "lexis_academic_register",
  "grammar_mechanics",
];

type Factor = {
  factor_key: string;
  factor_label: string;
  score: number;
  max_score: number;
  reason: string;
};

type Evaluation = {
  id: string;
  agent: string;
  total_score: number;
  factors: Factor[];
  corrective_feedback: unknown;
  improvement_feedback: unknown;
};

type Paragraph = {
  id: string;
  paragraph_id: string;
  paragraph_text: string;
  legacy_initial_score: number | null;
  evaluations: Evaluation[];
};

export function ParagraphsView({ paragraphs }: { paragraphs: Paragraph[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = paragraphs.filter(
    (p) =>
      p.paragraph_id.toLowerCase().includes(search.toLowerCase()) ||
      p.paragraph_text.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Paragraphs</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {paragraphs.length} paragraphs · AI scores from YAML dataset
          </p>
        </div>
        <input
          type="search"
          placeholder="Search paragraphs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border bg-white px-3 text-sm sm:w-64"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((paragraph) => {
          const isOpen = expanded.has(paragraph.id);
          return (
            <div key={paragraph.id} className="rounded-md border bg-white">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(paragraph.id)}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                )}
                <span className="w-16 shrink-0 font-semibold">{paragraph.paragraph_id}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted-foreground)]">
                  {paragraph.paragraph_text}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {paragraph.legacy_initial_score !== null && (
                    <Badge variant="outline">
                      Initial: {paragraph.legacy_initial_score}
                    </Badge>
                  )}
                  {paragraph.evaluations.map((evaluation) => (
                    <Badge key={evaluation.id}>
                      {evaluation.agent}: {evaluation.total_score}/10
                    </Badge>
                  ))}
                </div>
              </button>

              {isOpen && (
                <div className="border-t px-4 pb-4 pt-3 space-y-4">
                  <p className="text-sm leading-relaxed">{paragraph.paragraph_text}</p>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {paragraph.evaluations.map((evaluation) => {
                      const sortedFactors = [...evaluation.factors].sort(
                        (a, b) =>
                          FACTOR_ORDER.indexOf(a.factor_key) -
                          FACTOR_ORDER.indexOf(b.factor_key)
                      );
                      return (
                        <Card key={evaluation.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between text-base">
                              <span>{evaluation.agent}</span>
                              <Badge>{evaluation.total_score} / 10</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {sortedFactors.map((factor) => (
                              <div
                                key={factor.factor_key}
                                className="rounded-md border p-2 text-sm"
                              >
                                <div className="flex items-center justify-between font-medium">
                                  <span>{factor.factor_label}</span>
                                  <span>
                                    {factor.score} / {factor.max_score}
                                  </span>
                                </div>
                                {factor.reason && (
                                  <p className="mt-1 text-[var(--muted-foreground)]">
                                    {factor.reason}
                                  </p>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No paragraphs match your search.
        </p>
      )}
    </div>
  );
}
