import "server-only";

import { UserRole } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "./session";

type CreateUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
};

type CreateUserResult = {
  userId: string;
  email: string;
  profileCreated: boolean;
};

type CreateUserErrorCode =
  | "INVALID_EMAIL"
  | "MISSING_NAME"
  | "INVALID_PASSWORD"
  | "USER_ALREADY_EXISTS"
  | "AUTH_CREATE_FAILED"
  | "AUTH_USER_NOT_RETURNED"
  | "PROFILE_CREATE_FAILED";

export class CreatePiggyFlowUserError extends Error {
  constructor(
    public readonly code: CreateUserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CreatePiggyFlowUserError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertValidInput(input: CreateUserInput) {
  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const temporaryPassword = input.temporaryPassword;

  if (!firstName || !lastName) {
    throw new CreatePiggyFlowUserError(
      "MISSING_NAME",
      "Informe nome e sobrenome para criar o usuario.",
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CreatePiggyFlowUserError(
      "INVALID_EMAIL",
      "Informe um email valido para criar o usuario.",
    );
  }

  if (temporaryPassword.length < 8) {
    throw new CreatePiggyFlowUserError(
      "INVALID_PASSWORD",
      "A senha temporaria deve ter pelo menos 8 caracteres.",
    );
  }

  return {
    email,
    firstName,
    lastName,
    temporaryPassword,
  };
}

export async function createPiggyFlowUser(input: CreateUserInput): Promise<CreateUserResult> {
  await requireAdminUser();

  const { email, firstName, lastName, temporaryPassword } = assertValidInput(input);
  const existingProfile = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingProfile) {
    throw new CreatePiggyFlowUserError(
      "USER_ALREADY_EXISTS",
      "Ja existe um usuario do PiggyFlow com este email.",
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (error) {
    throw new CreatePiggyFlowUserError(
      "AUTH_CREATE_FAILED",
      "Nao foi possivel criar o usuario no Supabase Auth.",
    );
  }

  if (!data.user) {
    throw new CreatePiggyFlowUserError(
      "AUTH_USER_NOT_RETURNED",
      "O Supabase Auth nao retornou o usuario criado.",
    );
  }

  try {
    const profile = await prisma.user.create({
      data: {
        id: data.user.id,
        email,
        firstName,
        lastName,
        role: UserRole.USER,
        mustChangePassword: true,
      },
    });

    return {
      userId: profile.id,
      email: profile.email,
      profileCreated: true,
    };
  } catch (error) {
    console.error("PROFILE_CREATE_FAILED - original error:", error);
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => undefined);

    throw new CreatePiggyFlowUserError(
      "PROFILE_CREATE_FAILED",
      "O usuario foi criado no Auth, mas nao foi possivel criar o perfil no PiggyFlow.",
    );
  }
}