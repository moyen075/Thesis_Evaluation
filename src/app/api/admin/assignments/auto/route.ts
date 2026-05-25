import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api";
import { buildBalancedAssignments } from "@/lib/domain/assignment";

export async function POST() {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const [{ data: paragraphs, error: paragraphError }, { data: teachers, error: teacherError }, { data: tasks, error: taskError }] =
    await Promise.all([
      session.admin.from("paragraphs").select("id,paragraph_id").order("paragraph_id"),
      session.admin
        .from("profiles")
        .select("id,full_name")
        .eq("role", "TEACHER")
        .order("full_name"),
      session.admin
        .from("teacher_tasks")
        .select("paragraph_id,teacher_id,status")
        .neq("status", "ARCHIVED"),
    ]);

  if (paragraphError || teacherError || taskError) {
    return NextResponse.json(
      { error: paragraphError?.message ?? teacherError?.message ?? taskError?.message },
      { status: 500 }
    );
  }

  try {
    const result = buildBalancedAssignments(
      (paragraphs ?? []).map((paragraph) => paragraph.id),
      (teachers ?? []).map((teacher) => ({
        id: teacher.id,
        fullName: teacher.full_name,
      })),
      (tasks ?? []).map((task) => ({
        paragraphId: task.paragraph_id,
        teacherId: task.teacher_id,
        status: task.status,
      }))
    );

    if (result.inserts.length > 0) {
      const { error: insertError } = await session.admin
        .from("teacher_tasks")
        .insert(
          result.inserts.map((assignment) => ({
            paragraph_id: assignment.paragraphId,
            teacher_id: assignment.teacherId,
          }))
        );

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      created: result.inserts.length,
      loads: result.loads,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-assignment failed" },
      { status: 400 }
    );
  }
}

