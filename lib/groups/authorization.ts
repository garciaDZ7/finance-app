import "server-only";

import { notFound } from "next/navigation";

import { GroupMemberRole } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidGroupId(groupId: string) {
  if (!UUID_PATTERN.test(groupId)) {
    notFound();
  }
}

export async function requireGroupMember(groupId: string) {
  const profile = await requireCurrentUserProfile();
  assertValidGroupId(groupId);

  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      members: {
        some: {
          userId: profile.id,
          leftAt: null,
        },
      },
    },
    include: {
      members: {
        where: {
          leftAt: null,
        },
        orderBy: {
          joinedAt: "asc",
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const membership = group.members.find((member) => member.userId === profile.id);

  if (!membership) {
    notFound();
  }

  return {
    profile,
    group,
    membership,
  };
}

export async function requireGroupAdmin(groupId: string) {
  const result = await requireGroupMember(groupId);

  if (result.membership.role !== GroupMemberRole.ADMIN) {
    notFound();
  }

  return result;
}
