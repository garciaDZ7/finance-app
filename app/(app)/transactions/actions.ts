"use server";

import { redirect } from "next/navigation";

import { CategoryScope, TransactionType } from "@/app/generated/prisma/enums";
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
  | "TRANSACTION_NOT_FOUND"
  | "DELETE_FAILED"
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

function parseInput(formData: FormData): TransactionInput | null {
  const type = parseType(String(formData.get("type") ?? ""));
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const occurredAt = parseOccurredAt(String(formData.get("occurredAt") ?? ""));
  const description = parseDescription(String(formData.get("description") ?? ""));

  if (!type || !categoryId || !amount || !occurredAt || !description) {
    return null;
  }

  return { type, categoryId, amount, occurredAt, description };
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
    select: { id: true },
  });
}

export async function createTransaction(formData: FormData) {
  const profile = await requireCurrentUserProfile();
  const input = parseInput(formData);

  if (!input) {
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
  }

  const validInput = input as TransactionInput;
  const category = await hasPersonalCategory(profile.id, validInput.categoryId);

  if (!category) {
    redirectWithError("INVALID_CATEGORY");
  }

  try {
    await prisma.transaction.create({
      data: {
        type: validInput.type,
        amount: validInput.amount,
        occurredAt: validInput.occurredAt,
        description: validInput.description,
        categoryId: validInput.categoryId,
        responsibleUserId: profile.id,
        groupId: null,
        recurringTransactionId: null,
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
  const input = parseInput(formData);

  if (!transactionId) {
    redirectWithError("TRANSACTION_NOT_FOUND");
  }

  if (!input) {
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
  }

  const validInput = input as TransactionInput;
  const transaction = await findOwnedPersonalTransaction(profile.id, transactionId);

  if (!transaction) {
    redirectWithError("TRANSACTION_NOT_FOUND");
  }

  const category = await hasPersonalCategory(profile.id, validInput.categoryId);

  if (!category) {
    redirectWithError("INVALID_CATEGORY");
  }

  try {
    const updated = await prisma.transaction.updateMany({
      where: {
        id: transactionId,
        responsibleUserId: profile.id,
        groupId: null,
        category: {
          createdById: profile.id,
          scope: CategoryScope.PERSONAL,
          groupId: null,
        },
      },
      data: {
        type: validInput.type,
        amount: validInput.amount,
        occurredAt: validInput.occurredAt,
        description: validInput.description,
        categoryId: validInput.categoryId,
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

  try {
    const deleted = await prisma.transaction.deleteMany({
      where: {
        id: transactionId,
        responsibleUserId: profile.id,
        groupId: null,
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
