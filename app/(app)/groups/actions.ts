"use server";

import { redirect } from "next/navigation";

import { GroupMemberRole, GroupType } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";
import { requireGroupAdmin, requireGroupMember } from "@/lib/groups/authorization";

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
  | "CREATE_FAILED"
  | "INVALID_MEMBER"
  | "CANNOT_ADD_SELF"
  | "ALREADY_MEMBER"
  | "MEMBER_NOT_ACTIVE"
  | "LAST_ADMIN"
  | "MEMBER_UPDATE_FAILED";

function redirectWithError(code: GroupActionCode): never {
  redirect(`/groups?error=${encodeURIComponent(code)}`);
}

function redirectToGroup(groupId: string, status?: string, error?: GroupActionCode): never {
  const params = new URLSearchParams();

  if (status) {
    params.set("status", status);
  }

  if (error) {
    params.set("error", error);
  }

  redirect(`/groups/${groupId}?${params.toString()}`);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertMemberId(userId: string): string {
  if (!UUID_PATTERN.test(userId)) {
    redirectWithError("INVALID_MEMBER");
  }

  return userId;
}

class GroupMemberActionError extends Error {
  constructor(public readonly code: Extract<GroupActionCode, "ALREADY_MEMBER" | "MEMBER_NOT_ACTIVE" | "LAST_ADMIN">) {
    super(code);
  }
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

export async function addGroupMember(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "").trim();
  const { profile } = await requireGroupAdmin(groupId);
  const userId = assertMemberId(String(formData.get("userId") ?? "").trim());

  if (userId === profile.id) {
    redirectToGroup(groupId, undefined, "CANNOT_ADD_SELF");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!targetUser) {
    redirectToGroup(groupId, undefined, "INVALID_MEMBER");
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.groupMember.findUnique({
          where: {
            userId_groupId: {
              userId,
              groupId,
            },
          },
        });

        if (existing?.leftAt === null) {
          throw new GroupMemberActionError("ALREADY_MEMBER");
        }

        if (existing) {
          await tx.groupMember.update({
            where: { id: existing.id },
            data: {
              leftAt: null,
              role: GroupMemberRole.MEMBER,
              invitedById: profile.id,
              joinedAt: new Date(),
            },
          });
          return;
        }

        await tx.groupMember.create({
          data: {
            groupId,
            userId,
            role: GroupMemberRole.MEMBER,
            invitedById: profile.id,
            joinedAt: new Date(),
            leftAt: null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof GroupMemberActionError) {
      redirectToGroup(groupId, undefined, error.code);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectToGroup(groupId, undefined, "ALREADY_MEMBER");
    }

    redirectToGroup(groupId, undefined, "MEMBER_UPDATE_FAILED");
  }

  redirectToGroup(groupId, "member-added");
}

export async function removeGroupMember(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "").trim();
  await requireGroupAdmin(groupId);
  const userId = assertMemberId(String(formData.get("userId") ?? "").trim());

  try {
    await prisma.$transaction(
      async (tx) => {
        const membership = await tx.groupMember.findUnique({
          where: {
            userId_groupId: {
              userId,
              groupId,
            },
          },
        });

        if (!membership || membership.leftAt !== null) {
          throw new GroupMemberActionError("MEMBER_NOT_ACTIVE");
        }

        if (membership.role === GroupMemberRole.ADMIN) {
          const adminCount = await tx.groupMember.count({
            where: {
              groupId,
              role: GroupMemberRole.ADMIN,
              leftAt: null,
            },
          });

          if (adminCount <= 1) {
            throw new GroupMemberActionError("LAST_ADMIN");
          }
        }

        await tx.groupMember.update({
          where: { id: membership.id },
          data: { leftAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof GroupMemberActionError) {
      redirectToGroup(groupId, undefined, error.code);
    }

    redirectToGroup(groupId, undefined, "MEMBER_UPDATE_FAILED");
  }

  redirectToGroup(groupId, "member-removed");
}

export async function leaveGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "").trim();
  const { profile } = await requireGroupMember(groupId);

  try {
    await prisma.$transaction(
      async (tx) => {
        const membership = await tx.groupMember.findUnique({
          where: {
            userId_groupId: {
              userId: profile.id,
              groupId,
            },
          },
        });

        if (!membership || membership.leftAt !== null) {
          throw new GroupMemberActionError("MEMBER_NOT_ACTIVE");
        }

        if (membership.role === GroupMemberRole.ADMIN) {
          const adminCount = await tx.groupMember.count({
            where: {
              groupId,
              role: GroupMemberRole.ADMIN,
              leftAt: null,
            },
          });

          if (adminCount <= 1) {
            throw new GroupMemberActionError("LAST_ADMIN");
          }
        }

        await tx.groupMember.update({
          where: { id: membership.id },
          data: { leftAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof GroupMemberActionError) {
      redirectToGroup(groupId, undefined, error.code);
    }

    redirectToGroup(groupId, undefined, "MEMBER_UPDATE_FAILED");
  }

  redirectToGroup(groupId, "group-left");
}
