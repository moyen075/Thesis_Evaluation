import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    user,
    profile: profile as
      | {
          id: string;
          email: string;
          full_name: string;
          role: Role;
        }
      | null,
  };
}

export async function requireRole(roles: Role[]) {
  const session = await getSessionProfile();

  if (!session.user || !session.profile) {
    redirect("/login");
  }

  if (!roles.includes(session.profile.role)) {
    redirect(session.profile.role === "ADMIN" ? "/admin" : "/teacher/tasks");
  }

  return session as {
    user: NonNullable<typeof session.user>;
    profile: NonNullable<typeof session.profile>;
  };
}

