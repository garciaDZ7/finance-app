import { Prisma } from "@/app/generated/prisma/client";

export const MIN_INSTALLMENT_COUNT = 2;
export const MAX_INSTALLMENT_COUNT = 60;

type InstallmentScheduleItem = {
  amount: Prisma.Decimal;
  occurredAt: Date;
  installmentNumber: number;
};

function getAnchoredDate(firstOccurredAt: Date, monthOffset: number) {
  const year = firstOccurredAt.getUTCFullYear();
  const month = firstOccurredAt.getUTCMonth() + monthOffset;
  const anchorDay = firstOccurredAt.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchorDay, lastDayOfMonth);

  return new Date(Date.UTC(year, month, day));
}

export function buildInstallmentSchedule(
  totalAmount: Prisma.Decimal,
  installmentCount: number,
  firstOccurredAt: Date,
): InstallmentScheduleItem[] {
  if (
    installmentCount < MIN_INSTALLMENT_COUNT ||
    installmentCount > MAX_INSTALLMENT_COUNT
  ) {
    throw new Error("Invalid installment count");
  }

  const totalCents = BigInt(totalAmount.times(100).toFixed(0));
  const count = BigInt(installmentCount);
  const baseCents = totalCents / count;
  const remainderCents = totalCents % count;

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseCents + (index === installmentCount - 1 ? remainderCents : BigInt(0));

    return {
      amount: new Prisma.Decimal(cents.toString()).div(100),
      occurredAt: getAnchoredDate(firstOccurredAt, index),
      installmentNumber: index + 1,
    };
  });
}
