export function buildBalancedAssignments(paragraphIds, teachers, existingTasks = []) {
  if (teachers.length < 2) {
    throw new Error("At least two teachers are required for automatic assignment.");
  }

  const activeExisting = existingTasks.filter((task) => task.status !== "ARCHIVED");
  const loadByTeacher = new Map(teachers.map((teacher) => [teacher.id, 0]));
  const assignmentsByParagraph = new Map(
    paragraphIds.map((paragraphId) => [paragraphId, new Set()])
  );

  for (const task of activeExisting) {
    if (!loadByTeacher.has(task.teacherId)) continue;
    if (!assignmentsByParagraph.has(task.paragraphId)) continue;

    loadByTeacher.set(task.teacherId, (loadByTeacher.get(task.teacherId) ?? 0) + 1);
    assignmentsByParagraph.get(task.paragraphId).add(task.teacherId);
  }

  const inserts = [];

  for (const paragraphId of paragraphIds) {
    const assigned = assignmentsByParagraph.get(paragraphId);

    while (assigned.size < 2) {
      const candidate = [...teachers]
        .filter((teacher) => !assigned.has(teacher.id))
        .sort((a, b) => {
          const loadDelta = (loadByTeacher.get(a.id) ?? 0) - (loadByTeacher.get(b.id) ?? 0);
          if (loadDelta !== 0) return loadDelta;
          return a.fullName.localeCompare(b.fullName);
        })[0];

      if (!candidate) {
        throw new Error(`Could not assign two distinct teachers to ${paragraphId}`);
      }

      assigned.add(candidate.id);
      loadByTeacher.set(candidate.id, (loadByTeacher.get(candidate.id) ?? 0) + 1);
      inserts.push({ paragraphId, teacherId: candidate.id });
    }
  }

  return {
    inserts,
    loads: [...loadByTeacher.entries()].map(([teacherId, count]) => ({
      teacherId,
      count,
    })),
  };
}

export function validateManualAssignment(teacherIds) {
  const active = teacherIds.filter(Boolean);
  if (active.length !== 2) {
    return "Each paragraph must have exactly two teachers.";
  }
  if (new Set(active).size !== 2) {
    return "The same teacher cannot be assigned twice to one paragraph.";
  }
  return null;
}

