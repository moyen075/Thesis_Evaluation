import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export const FACTORS = [
  {
    key: "content_relevance",
    label: "Content & Relevance",
    maxScore: 3,
  },
  {
    key: "organization_cohesion",
    label: "Organization & Cohesion",
    maxScore: 2,
  },
  {
    key: "lexis_academic_register",
    label: "Lexis & Academic Register",
    maxScore: 2.5,
  },
  {
    key: "grammar_mechanics",
    label: "Grammar & Mechanics",
    maxScore: 2.5,
  },
];

const FACTOR_BY_LABEL = new Map(
  FACTORS.map((factor) => [factor.label.toLowerCase(), factor])
);

function normalizeFactor(label, maxScore, ordinal) {
  const trimmed = label.trim();

  if (
    trimmed.toLowerCase() === "organization & grammar & mechanics" ||
    (ordinal === 4 && Number(maxScore) === 2.5)
  ) {
    return FACTOR_BY_LABEL.get("grammar & mechanics");
  }

  return FACTOR_BY_LABEL.get(trimmed.toLowerCase()) ?? null;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanReason(line) {
  return line.replace(/^\s*Reason:\s*/i, "").trim();
}

export function parseFactorScores(feedback) {
  const lines = feedback.split(/\r?\n/);
  const factors = [];
  const warnings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(
      /^\s*(\d+)\.\s*([^:]+):\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*$/
    );

    if (!match) continue;

    const ordinal = Number(match[1]);
    const rawLabel = match[2].trim();
    const score = Number(match[3]);
    const maxScore = Number(match[4]);
    const factor = normalizeFactor(rawLabel, maxScore, ordinal);

    if (!factor) {
      warnings.push(`Unknown factor label "${rawLabel}"`);
      continue;
    }

    const reasonLines = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s*\d+\.\s*[^:]+:\s*[0-9]/.test(lines[j])) break;
      if (/^\s*Overall Score:/i.test(lines[j])) break;
      if (/^\s*Corrective Feedback:/i.test(lines[j])) break;
      if (/^\s*Improvement Feedback:/i.test(lines[j])) break;

      if (lines[j].trim()) {
        reasonLines.push(reasonLines.length === 0 ? cleanReason(lines[j]) : lines[j].trim());
      }
    }

    factors.push({
      factorKey: factor.key,
      factorLabel: factor.label,
      score,
      maxScore,
      reason: reasonLines.join(" ").trim(),
      rawLabel,
    });
  }

  if (factors.length !== 4) {
    warnings.push(`Expected 4 factor scores, found ${factors.length}`);
  }

  return { factors, warnings };
}

function sectionBetween(feedback, startHeading, nextHeadings) {
  const start = feedback.search(new RegExp(`^\\s*${startHeading}:\\s*$`, "im"));
  if (start === -1) return "";

  const afterStart = feedback.slice(start).replace(/^.*\n/, "");
  const nextIndexes = nextHeadings
    .map((heading) => afterStart.search(new RegExp(`^\\s*${heading}:\\s*$`, "im")))
    .filter((index) => index >= 0);
  const end = nextIndexes.length ? Math.min(...nextIndexes) : afterStart.length;

  return afterStart.slice(0, end).trim();
}

function parseNumberedFeedback(section, fieldNames) {
  if (!section) return [];

  const blocks = section
    .split(/\n(?=\s*\d+\.\s)/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const first = lines.shift() ?? "";
    const item = {
      sourceText: first.replace(/^\d+\.\s*/, "").replace(/^"|"$/g, ""),
    };

    for (const line of lines) {
      for (const field of fieldNames) {
        const pattern = new RegExp(`^${field}:\\s*(.*)$`, "i");
        const match = line.match(pattern);
        if (match) {
          const key = field
            .toLowerCase()
            .replace(/\s+([a-z])/g, (_, char) => char.toUpperCase());
          item[key] = match[1].trim();
        }
      }
    }

    return item;
  });
}

export function parseAIEvaluation(agent, value) {
  const feedback = String(value?.feedback ?? "");
  const totalScore = Number(value?.score);
  const { factors, warnings } = parseFactorScores(feedback);
  const sum = Number(factors.reduce((total, factor) => total + factor.score, 0).toFixed(2));

  if (Number.isFinite(totalScore) && Math.abs(totalScore - sum) > 0.01) {
    warnings.push(`Total score ${totalScore} does not match factor sum ${sum}`);
  }

  const correctiveSection = sectionBetween(feedback, "Corrective Feedback", [
    "Improvement Feedback",
  ]);
  const improvementSection = sectionBetween(feedback, "Improvement Feedback", []);

  return {
    agent,
    totalScore,
    rawFeedback: feedback,
    factors,
    correctiveFeedback: parseNumberedFeedback(correctiveSection, [
      "Issue",
      "Correction",
    ]),
    improvementFeedback: parseNumberedFeedback(improvementSection, [
      "Target Area",
      "Suggestion",
    ]),
    warnings,
  };
}

export function parseFakeNewsYamlFile(filePath) {
  const rawText = fs.readFileSync(filePath, "utf8");
  const raw = yaml.load(rawText);
  const warnings = [];

  if (!raw || typeof raw !== "object") {
    throw new Error(`${filePath} does not contain a YAML object`);
  }

  const paragraphId = String(raw.paragraph_id ?? "").trim();
  const paragraphText = String(raw.paragraph ?? "").trim();

  if (!paragraphId) warnings.push("Missing paragraph_id");
  if (!paragraphText) warnings.push("Missing paragraph text");

  const aiEvaluations = ["gemini", "llama"].map((agent) =>
    parseAIEvaluation(agent.toUpperCase(), raw[agent])
  );

  return {
    filePath,
    paragraphId,
    paragraphText,
    legacyInitialScore: toNullableNumber(raw.initial_score),
    rawYaml: raw,
    aiEvaluations,
    warnings,
  };
}

export function parseFakeNewsDirectory(directoryPath) {
  const files = fs
    .readdirSync(directoryPath)
    .filter((file) => /^P-\d+\.yaml$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => path.join(directoryPath, file));

  return files.map(parseFakeNewsYamlFile);
}

export function summarizeParsedDataset(records) {
  const aiEvaluations = records.flatMap((record) => record.aiEvaluations);
  const factorScores = aiEvaluations.flatMap((evaluation) => evaluation.factors);
  const warnings = records.flatMap((record) => [
    ...record.warnings.map((warning) => `${record.paragraphId}: ${warning}`),
    ...record.aiEvaluations.flatMap((evaluation) =>
      evaluation.warnings.map(
        (warning) => `${record.paragraphId} ${evaluation.agent}: ${warning}`
      )
    ),
  ]);

  return {
    paragraphCount: records.length,
    aiEvaluationCount: aiEvaluations.length,
    factorScoreCount: factorScores.length,
    warnings,
  };
}

