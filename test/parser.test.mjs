import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  parseFakeNewsDirectory,
  summarizeParsedDataset,
} from "../src/lib/data/fake-news-parser.js";

const datasetDir = path.resolve(process.cwd(), "..", "Fake_News");

test("parses Fake_News YAML dataset into required structured parts", () => {
  const records = parseFakeNewsDirectory(datasetDir);
  const summary = summarizeParsedDataset(records);

  assert.equal(summary.paragraphCount, 51);
  assert.equal(summary.aiEvaluationCount, 102);
  assert.equal(summary.factorScoreCount, 408);
  assert.equal(summary.warnings.length, 0);
});

test("handles blank legacy initial scores", () => {
  const records = parseFakeNewsDirectory(datasetDir);
  const blankIds = records
    .filter((record) => record.legacyInitialScore === null)
    .map((record) => record.paragraphId)
    .sort();

  assert.deepEqual(blankIds, ["P-22", "P-51"]);
});

test("normalizes known malformed factor label", () => {
  const records = parseFakeNewsDirectory(datasetDir);
  const rawLabels = records.flatMap((record) =>
    record.aiEvaluations.flatMap((evaluation) =>
      evaluation.factors.map((factor) => ({
        rawLabel: factor.rawLabel,
        factorKey: factor.factorKey,
      }))
    )
  );
  const normalized = rawLabels.find(
    (item) => item.rawLabel === "Organization & Grammar & Mechanics"
  );

  assert.equal(normalized?.factorKey, "grammar_mechanics");
});

test("AI total scores match parsed factor sums", () => {
  const records = parseFakeNewsDirectory(datasetDir);

  for (const record of records) {
    for (const evaluation of record.aiEvaluations) {
      const sum = Number(
        evaluation.factors.reduce((total, factor) => total + factor.score, 0).toFixed(2)
      );
      assert.equal(
        evaluation.totalScore,
        sum,
        `${record.paragraphId} ${evaluation.agent}`
      );
    }
  }
});

