"use server";

import { redirect } from "next/navigation";

import { CategoryScope } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";

const MAX_CATEGORY_NAME_LENGTH = 80;

type CategoryActionCode =
  | "INVALID_NAME"
  | "DUPLICATE_NAME"
  | "CATEGORY_NOT_FOUND"
  | "DELETE_FAILED";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getCategoryName(formData: FormData) {
  const name = normalizeName(String(formData.get("name") ?? ""));

  if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) {
    return null;
  }

  return name;
}

function getCategoryId(formData: FormData) {
  const id = String(formData.get("categoryId") ?? "").trim();
  return id || null;
}

function redirectWithError(code: CategoryActionCode): never {
  redirect(`/categories?error=${encodeURIComponent(code)}`);
}

async function hasDuplicateName(userId: string, name: string, excludedId?: string) {
  const categories = await prisma.category.findMany({
    where: {
      createdById: userId,
      scope: CategoryScope.PERSONAL,
      groupId: null,
      ...(excludedId ? { NOT: { id: excludedId } } : {}),
    },
    select: {
      id: true,
      name: true,
    },
  });

  const normalizedName = name.toLocaleLowerCase();

  return categories.some(
    (category) => category.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalizedName,
  );
}

export async function createCategory(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const name = getCategoryName(formData);

  if (!name) {
    redirectWithError("INVALID_NAME");
  }

  if (await hasDuplicateName(profile.id, name)) {
    redirectWithError("DUPLICATE_NAME");
  }

  await prisma.category.create({
    data: {
      name,
      scope: CategoryScope.PERSONAL,
      groupId: null,
      createdById: profile.id,
    },
  });

  redirect("/categories?status=created");
}

export async function updateCategory(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const categoryId = getCategoryId(formData);
  const name = getCategoryName(formData);

  if (!categoryId) {
    redirectWithError("CATEGORY_NOT_FOUND");
  }

  if (!name) {
    redirectWithError("INVALID_NAME");
  }

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      createdById: profile.id,
      scope: CategoryScope.PERSONAL,
      groupId: null,
    },
    select: { id: true },
  });

  if (!category) {
    redirectWithError("CATEGORY_NOT_FOUND");
  }

  if (await hasDuplicateName(profile.id, name, categoryId)) {
    redirectWithError("DUPLICATE_NAME");
  }

  const updated = await prisma.category.updateMany({
    where: {
      id: categoryId,
      createdById: profile.id,
      scope: CategoryScope.PERSONAL,
      groupId: null,
    },
    data: { name },
  });

  if (updated.count === 0) {
    redirectWithError("CATEGORY_NOT_FOUND");
  }

  redirect("/categories?status=updated");
}

export async function deleteCategory(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const categoryId = getCategoryId(formData);

  if (!categoryId) {
    redirectWithError("CATEGORY_NOT_FOUND");
  }

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      createdById: profile.id,
      scope: CategoryScope.PERSONAL,
      groupId: null,
    },
    select: { id: true },
  });

  if (!category) {
    redirectWithError("CATEGORY_NOT_FOUND");
  }

  try {
    const deleted = await prisma.category.deleteMany({
      where: {
        id: categoryId,
        createdById: profile.id,
        scope: CategoryScope.PERSONAL,
        groupId: null,
      },
    });

    if (deleted.count === 0) {
      redirectWithError("CATEGORY_NOT_FOUND");
    }
  } catch {
    redirectWithError("DELETE_FAILED");
  }

  redirect("/categories?status=deleted");
}
