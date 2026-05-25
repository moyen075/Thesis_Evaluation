import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api";
import { teacherCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const { data, error } = await session.admin
    .from("profiles")
    .select("id,email,full_name,role,created_at")
    .eq("role", "TEACHER")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing teacher id" }, { status: 400 });
  }

  const { error } = await session.admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: id });
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(["ADMIN"]);
  if (session.error) return session.error;

  const parsed = teacherCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, fullName } = parsed.data;
  const { data: authData, error: authError } =
    await session.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "TEACHER" },
    });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Teacher account creation failed" },
      { status: 400 }
    );
  }

  const { data, error } = await session.admin
    .from("profiles")
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role: "TEACHER",
    })
    .select("id,email,full_name,role,created_at")
    .single();

  if (error) {
    await session.admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

