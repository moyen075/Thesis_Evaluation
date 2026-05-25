import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user, profile } = await getSessionProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  redirect(profile.role === "ADMIN" ? "/admin" : "/teacher/tasks");
}

