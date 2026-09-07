"use server";

import { redirect } from "next/navigation";

import { createPiggyFlowUser, CreatePiggyFlowUserError } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}

export async function createUser(formData: FormData) {
  const firstName = formData.get("firstName")?.toString() ?? "";
  const lastName = formData.get("lastName")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const temporaryPassword = formData.get("temporaryPassword")?.toString() ?? "";
  let redirectPath: string;

  try {
    await createPiggyFlowUser({ firstName, lastName, email, temporaryPassword });
    redirectPath = "/dashboard?create=success";
  } catch (err) {
    const code = err instanceof CreatePiggyFlowUserError ? err.code : "UNKNOWN";
    redirectPath = `/dashboard?create=error&code=${encodeURIComponent(code)}`;
  }

  redirect(redirectPath);
}