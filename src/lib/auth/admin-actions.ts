"use server";

import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export async function signIn(input: { email: string; password: string }) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.auth.signInWithPassword(input);

  if (error) {
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }

  redirect("/admin/dashboard");
}

export async function signOut() {
  const supabase = await createAdminServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
