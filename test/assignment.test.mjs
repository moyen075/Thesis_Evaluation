import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBalancedAssignments,
  validateManualAssignment,
} from "../src/lib/domain/assignment.js";

test("assigns every paragraph to two distinct teachers with balanced load", () => {
  const paragraphs = Array.from({ length: 5 }, (_, index) => `p${index + 1}`);
  const teachers = [
    { id: "t1", fullName: "A Teacher" },
    { id: "t2", fullName: "B Teacher" },
    { id: "t3", fullName: "C Teacher" },
  ];

  const result = buildBalancedAssignments(paragraphs, teachers);
  const byParagraph = new Map();

  for (const insert of result.inserts) {
    const list = byParagraph.get(insert.paragraphId) ?? [];
    list.push(insert.teacherId);
    byParagraph.set(insert.paragraphId, list);
  }

  for (const paragraph of paragraphs) {
    assert.equal(byParagraph.get(paragraph).length, 2);
    assert.equal(new Set(byParagraph.get(paragraph)).size, 2);
  }

  const loads = result.loads.map((load) => load.count);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 1);
});

test("automatic assignment requires at least two teachers", () => {
  assert.throws(
    () => buildBalancedAssignments(["p1"], [{ id: "t1", fullName: "Teacher" }]),
    /At least two teachers/
  );
});

test("manual assignment rejects duplicate teacher choices", () => {
  assert.equal(validateManualAssignment(["t1", "t1"]), "The same teacher cannot be assigned twice to one paragraph.");
  assert.equal(validateManualAssignment(["t1", "t2"]), null);
});

