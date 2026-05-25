export interface AssignmentTeacher {
  id: string;
  fullName: string;
}

export interface ExistingTask {
  paragraphId: string;
  teacherId: string;
  status: string;
}

export function buildBalancedAssignments(
  paragraphIds: string[],
  teachers: AssignmentTeacher[],
  existingTasks?: ExistingTask[]
): {
  inserts: Array<{ paragraphId: string; teacherId: string }>;
  loads: Array<{ teacherId: string; count: number }>;
};

export function validateManualAssignment(
  teacherIds: Array<string | null | undefined>
): string | null;

