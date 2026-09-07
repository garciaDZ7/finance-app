import "server-only";

import { redirect } from "next/navigation";

import { UserRole } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireAuthUser() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getCurrentUserProfile() {
  const user = await getAuthUser();

  if (!user) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });
}

export async function requireCurrentUserProfile() {
  const user = await requireAuthUser();
  const profile = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });

  if (!profile) {
    redirect("/login?error=profile-not-found");
  }

  if (profile.mustChangePassword) {
    redirect("/set-password");
  }

  return profile;
}

export async function requireAdminUser() {
  const profile = await requireCurrentUserProfile();

  if (profile.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  return profile;
}