import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api";
import { validateManualAssignment } from "@/lib/domain/assignment";
import { manualAssignmentSchema } from "@/lib/validators";

export async function DELETE(request: NextRequest) {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const { paragraphId } = await request.json();
  if (!paragraphId) {
    return NextResponse.json({ error: "Missing paragraphId" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await session.admin
    .from("teacher_tasks")
    .select("id,status")
    .eq("paragraph_id", paragraphId)
    .neq("status", "ARCHIVED");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const locked = (existing ?? []).some((task) => task.status !== "NOT_STARTED");
  if (locked) {
    return NextResponse.json(
      { error: "Cannot clear assignments — a teacher has already started work." },
      { status: 409 }
    );
  }

  const ids = (existing ?? []).map((task) => task.id);
  if (ids.length > 0) {
    const { error: deleteError } = await session.admin
      .from("teacher_tasks")
      .delete()
      .in("id", ids);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ cleared: ids.length });
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const parsed = manualAssignmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { paragraphId, teacherIds } = parsed.data;
  const validationError = validateManualAssignment(teacherIds);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await session.admin
    .from("teacher_tasks")
    .select("id,teacher_id,status")
    .eq("paragraph_id", paragraphId)
    .neq("status", "ARCHIVED");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingTeacherIds = new Set((existing ?? []).map((task) => task.teacher_id));
  const newTeacherIds = new Set(teacherIds);
  const changed =
    existingTeacherIds.size !== newTeacherIds.size ||
    [...existingTeacherIds].some((id) => !newTeacherIds.has(id));
  const locked = (existing ?? []).some((task) => task.status !== "NOT_STARTED");

  if (changed && locked) {
    return NextResponse.json(
      { error: "Started tasks are locked and cannot be reassigned." },
      { status: 409 }
    );
  }

  const deleteIds = (existing ?? [])
    .filter((task) => !newTeacherIds.has(task.teacher_id))
    .map((task) => task.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } = await session.admin
      .from("teacher_tasks")
      .delete()
      .in("id", deleteIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const insertIds = teacherIds.filter((teacherId) => !existingTeacherIds.has(teacherId));

  if (insertIds.length > 0) {
    const { error: insertError } = await session.admin
      .from("teacher_tasks")
      .insert(
        insertIds.map((teacherId) => ({
          paragraph_id: paragraphId,
          teacher_id: teacherId,
        }))
      );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

