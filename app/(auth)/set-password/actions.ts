"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || password.length < 8) {
    redirect("/set-password?error=weak-password");
  }

  if (password !== confirmPassword) {
    redirect("/set-password?error=password-mismatch");
  }

  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/set-password?error=update-failed");
  }

  try {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        mustChangePassword: false,
      },
    });
  } catch {
    redirect("/set-password?error=profile-update-failed");
  }

  redirect("/dashboard");
}