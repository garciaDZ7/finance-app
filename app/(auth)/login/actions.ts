"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing-credentials");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=invalid-credentials");
  }

  const profile = data.user
    ? await prisma.user.findUnique({
        where: {
          id: data.user.id,
        },
      })
    : null;

  if (!profile) {
    redirect("/login?error=profile-not-found");
  }

  if (profile.mustChangePassword) {
    redirect("/set-password");
  }

  redirect("/dashboard");
}