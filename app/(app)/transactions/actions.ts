"use server";

import { redirect } from "next/navigation";

import { CategoryScope, TransactionType } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import {
  buildInstallmentSchedule,
  MAX_INSTALLMENT_COUNT,
  MIN_INSTALLMENT_COUNT,
} from "@/lib/transactions/installments";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";

const MAX_DESCRIPTION_LENGTH = 200;
const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type TransactionActionCode =
  | "INVALID_TYPE"
  | "INVALID_CATEGORY"
  | "INVALID_AMOUNT"
  | "INVALID_DATE"
  | "INVALID_DESCRIPTION"
  | "INVALID_INSTALLMENT_COUNT"
  | "TRANSACTION_NOT_FOUND"
  | "INSTALLMENT_IMMUTABLE"
  | "DELETE_FAILED"
  | "INSTALLMENT_DELETE_FAILED"
  | "UNEXPECTED_ERROR";

type TransactionInput = {
  type: TransactionType;
  categoryId: string;
  amount: string;
  occurredAt: Date;
  description: string;
};

function redirectWithError(code: TransactionActionCode): never {
  redirect(`/transactions?error=${encodeURIComponent(code)}`);
}

function getTransactionId(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  return transactionId || null;
}

function parseType(value: string): TransactionType | null {
  if (value === TransactionType.INCOME || value === TransactionType.EXPENSE) {
    return value;
  }

  return null;
}

function parseAmount(value: string) {
  const amount = value.trim();

  if (!DECIMAL_AMOUNT_PATTERN.test(amount) || /^0(?:\.0{1,2})?$/.test(amount)) {
    return null;
  }

  return amount;
}

function parseOccurredAt(value: string) {
  const match = DATE_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const occurredAt = new Date(Date.UTC(year, month - 1, day));

  if (
    occurredAt.getUTCFullYear() !== year ||
    occurredAt.getUTCMonth() !== month - 1 ||
    occurredAt.getUTCDate() !== day
  ) {
    return null;
  }

  return occurredAt;
}

function parseDescription(value: string) {
  const description = value.trim();

  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    return null;
  }

  return description;
}

function parseInput(formData: FormData) {
  const type = parseType(String(formData.get("type") ?? ""));
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const occurredAt = parseOccurredAt(String(formData.get("occurredAt") ?? ""));
  const description = parseDescription(String(formData.get("description") ?? ""));

  if (!type) redirectWithError("INVALID_TYPE");
  if (!categoryId) redirectWithError("INVALID_CATEGORY");
  if (!amount) redirectWithError("INVALID_AMOUNT");
  if (!occurredAt) redirectWithError("INVALID_DATE");
  if (!description) redirectWithError("INVALID_DESCRIPTION");

  return { type, categoryId, amount, occurredAt, description } satisfies TransactionInput;
}

function parseInstallmentCount(formData: FormData) {
  const value = String(formData.get("installmentCount") ?? "").trim();

  if (!/^\d+$/.test(value)) {
    redirectWithError("INVALID_INSTALLMENT_COUNT");
  }

  const count = Number(value);

  if (count < MIN_INSTALLMENT_COUNT || count > MAX_INSTALLMENT_COUNT) {
    redirectWithError("INVALID_INSTALLMENT_COUNT");
  }

  return count;
}

async function hasPersonalCategory(userId: string, categoryId: string) {
  return prisma.category.findFirst({
    where: {
      id: categoryId,
      createdById: userId,
      scope: CategoryScope.PERSONAL,
      groupId: null,
    },
    select: { id: true },
  });
}

async function findOwnedPersonalTransaction(userId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: {
      id: transactionId,
      responsibleUserId: userId,
      groupId: null,
      category: {
        createdById: userId,
        scope: CategoryScope.PERSONAL,
        groupId: null,
      },
    },
    select: {
      id: true,
      installmentPlanId: true,
    },
  });
}

export async function createTransaction(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const input = parseInput(formData);
  const category = await hasPersonalCategory(profile.id, input.categoryId);

  if (!category) {
    redirectWithError("INVALID_CATEGORY");
  }

  const isInstallment = formData.get("isInstallment") === "yes";

  if (isInstallment) {
    const installmentCount = parseInstallmentCount(formData);
    const totalAmount = new Prisma.Decimal(input.amount);
    const schedule = buildInstallmentSchedule(
      totalAmount,
      installmentCount,
      input.occurredAt,
    );

    try {
      await prisma.$transaction(async (tx) => {
        const plan = await tx.installmentPlan.create({
          data: {
            totalAmount,
            installmentCount,
            firstOccurredAt: input.occurredAt,
            description: input.description,
            responsibleUserId: profile.id,
            categoryId: input.categoryId,
          },
        });

        await tx.transaction.createMany({
          data: schedule.map((installment) => ({
            type: input.type,
            amount: installment.amount,
            occurredAt: installment.occurredAt,
            description: input.description,
            categoryId: input.categoryId,
            responsibleUserId: profile.id,
            groupId: null,
            recurringTransactionId: null,
            installmentPlanId: plan.id,
            installmentNumber: installment.installmentNumber,
          })),
        });
      });
    } catch {
      redirectWithError("UNEXPECTED_ERROR");
    }

    redirect("/transactions?status=created");
  }

  try {
    await prisma.transaction.create({
      data: {
        type: input.type,
        amount: input.amount,
        occurredAt: input.occurredAt,
        description: input.description,
        categoryId: input.categoryId,
        responsibleUserId: profile.id,
        groupId: null,
        recurringTransactionId: null,
        installmentPlanId: null,
        installmentNumber: null,
      },
    });
  } catch {
    redirectWithError("UNEXPECTED_ERROR");
  }

  redirect("/transactions?status=created");
}

export async function updateTransaction(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const transactionId = getTransactionId(formData);

  if (!transactionId) {
    redirectWithError("TRANSACTION_NOT_FOUND");
  }

  const transaction = await findOwnedPersonalTransaction(profile.id, transactionId);

  if (!transaction) {
    redirectWithError("TRANSACTION_NOT_FOUND");
  }

  if (transaction.installmentPlanId) {
    redirectWithError("INSTALLMENT_IMMUTABLE");
  }

  const input = parseInput(formData);
  const category = await hasPersonalCategory(profile.id, input.categoryId);

  if (!category) {
    redirectWithError("INVALID_CATEGORY");
  }

  try {
    const updated = await prisma.transaction.updateMany({
      where: {
        id: transactionId,
        responsibleUserId: profile.id,
        groupId: null,
        installmentPlanId: null,
        category: {
          createdById: profile.id,
          scope: CategoryScope.PERSONAL,
          groupId: null,
        },
      },
      data: {
        type: input.type,
        amount: input.amount,
        occurredAt: input.occurredAt,
        description: input.description,
        categoryId: input.categoryId,
      },
    });

    if (updated.count === 0) {
      redirectWithError("TRANSACTION_NOT_FOUND");
    }
  } catch {
    redirectWithError("UNEXPECTED_ERROR");
  }

  redirect("/transactions?status=updated");
}

export async function deleteTransaction(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const transactionId = getTransactionId(formData);

  if (!transactionId) {
    redirectWithError("TRANSACTION_NOT_FOUND");
  }

  const transaction = await findOwnedPersonalTransaction(profile.id, transactionId);

  if (!transaction) {
    redirectWithError("TRANSACTION_NOT_FOUND");
  }

  if (transaction.installmentPlanId) {
    const plan = await prisma.installmentPlan.findFirst({
      where: {
        id: transaction.installmentPlanId,
        responsibleUserId: profile.id,
      },
      include: {
        transactions: {
          select: {
            id: true,
            split: { select: { id: true } },
            attachment: { select: { id: true } },
          },
        },
      },
    });

    if (!plan) {
      redirectWithError("INSTALLMENT_DELETE_FAILED");
    }

    if (plan.transactions.some((item) => item.split || item.attachment)) {
      redirectWithError("INSTALLMENT_DELETE_FAILED");
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.deleteMany({
          where: {
            installmentPlanId: plan.id,
            responsibleUserId: profile.id,
            groupId: null,
          },
        });
        await tx.installmentPlan.delete({ where: { id: plan.id } });
      });
    } catch {
      redirectWithError("INSTALLMENT_DELETE_FAILED");
    }

    redirect("/transactions?status=deleted");
  }

  try {
    const deleted = await prisma.transaction.deleteMany({
      where: {
        id: transactionId,
        responsibleUserId: profile.id,
        groupId: null,
        installmentPlanId: null,
        category: {
          createdById: profile.id,
          scope: CategoryScope.PERSONAL,
          groupId: null,
        },
      },
    });

    if (deleted.count === 0) {
      redirectWithError("TRANSACTION_NOT_FOUND");
    }
  } catch {
    redirectWithError("DELETE_FAILED");
  }

  redirect("/transactions?status=deleted");
}
