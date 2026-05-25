import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME || "Research Admin";

if (!url || !serviceKey || !email || !password) {
  throw new Error("Missing Supabase or ADMIN_* environment variables.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;

let user = listData.users.find(
  (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
);

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "ADMIN" },
  });
  if (error) throw error;
  user = data.user;
}

const { error: profileError } = await supabase.from("profiles").upsert(
  {
    id: user.id,
    email,
    full_name: fullName,
    role: "ADMIN",
  },
  { onConflict: "id" }
);

if (profileError) throw profileError;

console.log(`Admin ready: ${email}`);

