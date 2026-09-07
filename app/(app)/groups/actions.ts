"use server";

import { redirect } from "next/navigation";

import { GroupMemberRole, GroupType } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";

const MAX_GROUP_NAME_LENGTH = 80;
const MAX_GROUP_DESCRIPTION_LENGTH = 500;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type GroupActionCode =
  | "INVALID_NAME"
  | "INVALID_DESCRIPTION"
  | "INVALID_TYPE"
  | "INVALID_START_DATE"
  | "INVALID_END_DATE"
  | "END_DATE_BEFORE_START"
  | "CREATE_FAILED";

function redirectWithError(code: GroupActionCode): never {
  redirect(`/groups?error=${encodeURIComponent(code)}`);
}

function parseDate(value: string) {
  const match = DATE_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseGroupInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const descriptionValue = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const startDateValue = String(formData.get("startDate") ?? "").trim();
  const endDateValue = String(formData.get("endDate") ?? "").trim();

  if (!name || name.length > MAX_GROUP_NAME_LENGTH) {
    redirectWithError("INVALID_NAME");
  }

  if (descriptionValue.length > MAX_GROUP_DESCRIPTION_LENGTH) {
    redirectWithError("INVALID_DESCRIPTION");
  }

  if (type !== GroupType.PERMANENT && type !== GroupType.EVENT) {
    redirectWithError("INVALID_TYPE");
  }

  const startDate = startDateValue ? parseDate(startDateValue) : null;
  const endDate = endDateValue ? parseDate(endDateValue) : null;

  if (startDateValue && !startDate) {
    redirectWithError("INVALID_START_DATE");
  }

  if (endDateValue && !endDate) {
    redirectWithError("INVALID_END_DATE");
  }

  if (type === GroupType.EVENT && !startDate) {
    redirectWithError("INVALID_START_DATE");
  }

  if (type === GroupType.EVENT && !endDate) {
    redirectWithError("INVALID_END_DATE");
  }

  if (type === GroupType.PERMANENT && endDate) {
    redirectWithError("INVALID_END_DATE");
  }

  if (startDate && endDate && endDate < startDate) {
    redirectWithError("END_DATE_BEFORE_START");
  }

  return {
    name,
    description: descriptionValue || null,
    type,
    startDate,
    endDate: type === GroupType.PERMANENT ? null : endDate,
  };
}

export async function createGroup(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const input = parseGroupInput(formData);
  let redirectPath = "/groups?status=created";

  try {
    await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: input.name,
          description: input.description,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          createdById: profile.id,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: profile.id,
          role: GroupMemberRole.ADMIN,
          leftAt: null,
          invitedById: null,
        },
      });
    });
  } catch {
    redirectPath = "/groups?error=CREATE_FAILED";
  }

  redirect(redirectPath);
}
