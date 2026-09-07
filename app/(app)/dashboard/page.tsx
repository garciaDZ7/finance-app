import { requireCurrentUserProfile } from "@/lib/auth/session";
import { signOut, createUser } from "./actions";
import { UserRole } from "@/app/generated/prisma/enums";
import { CategoryScope, TransactionType } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type SearchParams = { [key: string]: string | string[] | undefined };

const monthPattern = /^(\d{4})-(\d{2})$/;

function getCurrentMonth() {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${now.getUTCFullYear()}-${month}`;
}

function getMonthPeriod(value: string | string[] | undefined) {
  const requestedMonth = Array.isArray(value) ? value[0] : value;
  const month = requestedMonth && monthPattern.test(requestedMonth) ? requestedMonth : getCurrentMonth();
  const match = monthPattern.exec(month);

  if (!match) {
    return getMonthPeriod(getCurrentMonth());
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    return getMonthPeriod(getCurrentMonth());
  }

  return {
    month,
    monthStart: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function formatCurrency(value: Prisma.Decimal) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value.toNumber());
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireCurrentUserProfile();
  const params = await searchParams;
  const period = getMonthPeriod(params.month);
  const baseWhere = {
    responsibleUserId: user.id,
    groupId: null,
    occurredAt: {
      gte: period.monthStart,
      lt: period.nextMonthStart,
    },
    category: {
      createdById: user.id,
      scope: CategoryScope.PERSONAL,
      groupId: null,
    },
  };

  const [totalsByType, expensesByCategory, transactionCount] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: baseWhere,
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        ...baseWhere,
        type: TransactionType.EXPENSE,
      },
      _sum: { amount: true },
    }),
    prisma.transaction.count({ where: baseWhere }),
  ]);

  const expenseCategoryIds = expensesByCategory
    .map((expense) => expense.categoryId)
    .filter((categoryId): categoryId is string => categoryId !== null);
  const expenseCategories = await prisma.category.findMany({
    where: {
      id: { in: expenseCategoryIds },
      createdById: user.id,
      scope: CategoryScope.PERSONAL,
      groupId: null,
    },
    select: { id: true, name: true },
  });
  const categoryNames = new Map(expenseCategories.map((category) => [category.id, category.name]));
  const zero = new Prisma.Decimal(0);
  const incomeTotal = totalsByType.find((total) => total.type === TransactionType.INCOME)?._sum.amount ?? zero;
  const expenseTotal = totalsByType.find((total) => total.type === TransactionType.EXPENSE)?._sum.amount ?? zero;
  const balance = incomeTotal.minus(expenseTotal);
  const expensesByCategoryWithNames = expensesByCategory
    .map((expense) => ({
      name: expense.categoryId ? categoryNames.get(expense.categoryId) : undefined,
      amount: expense._sum.amount ?? zero,
    }))
    .filter((expense): expense is { name: string; amount: Prisma.Decimal } => Boolean(expense.name))
    .sort((first, second) => second.amount.comparedTo(first.amount));

  const createStatus = (() => {
    const v = params.create;
    return Array.isArray(v) ? v[0] : (v as string | undefined);
  })();

  const createCode = (() => {
    const v = params.code;
    return Array.isArray(v) ? v[0] : (v as string | undefined);
  })();

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
          </div>
          <form action={signOut}>
            <button
              className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-100 transition hover:border-zinc-400"
              type="submit"
            >
              Sair
            </button>
          </form>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Ola, {user.firstName}</h2>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Sua sessao esta ativa. As areas financeiras serao conectadas nas proximas etapas.
          </p>
          <a
            className="inline-flex text-sm font-medium text-emerald-300 hover:text-emerald-200"
            href="/categories"
          >
            Gerenciar categorias pessoais
          </a>
          <a
            className="inline-flex text-sm font-medium text-emerald-300 hover:text-emerald-200"
            href="/transactions"
          >
            Gerenciar transacoes pessoais
          </a>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Dashboard Financeiro</h2>
              <p className="mt-2 text-sm text-zinc-400">Acompanhe suas receitas e despesas pessoais.</p>
            </div>
            <form method="get" className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-sm text-zinc-300">
                <span>Mes</span>
                <input
                  type="month"
                  name="month"
                  defaultValue={period.month}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50"
                />
              </label>
              <button
                type="submit"
                className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Aplicar
              </button>
            </form>
          </div>

          <p className="text-sm capitalize text-zinc-400">Resumo de {formatMonth(period.month)}</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-sm text-zinc-400">Receitas</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(incomeTotal)}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-sm text-zinc-400">Despesas</p>
              <p className="mt-2 text-2xl font-semibold text-rose-300">{formatCurrency(expenseTotal)}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-sm text-zinc-400">Saldo</p>
              <p className={`mt-2 text-2xl font-semibold ${balance.isNegative() ? "text-rose-300" : "text-emerald-300"}`}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-sm text-zinc-400">Lancamentos</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-50">{transactionCount}</p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="text-lg font-semibold">Gastos por categoria</h3>
            {expensesByCategoryWithNames.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">Nenhuma despesa registrada neste mes.</p>
            ) : (
              <div className="mt-4 divide-y divide-zinc-800">
                {expensesByCategoryWithNames.map((expense) => (
                  <div key={expense.name} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-zinc-300">{expense.name}</span>
                    <span className="font-medium text-rose-300">{formatCurrency(expense.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {isAdmin && (
          <section className="mt-6 rounded-md border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="mb-4 text-lg font-semibold">Administracao de Usuarios</h3>

            {createStatus === "success" && (
              <div className="mb-4 rounded-md bg-emerald-800/30 px-4 py-2 text-emerald-200">
                Usuario criado com sucesso. Entregue ao usuario o e-mail e a senha temporaria.
              </div>
            )}

            {createStatus === "error" && (
              <div className="mb-4 rounded-md bg-rose-800/30 px-4 py-2 text-rose-200">
                Falha ao criar usuario. Codigo: {createCode ?? "UNKNOWN"}.
              </div>
            )}

            <form action={createUser} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-zinc-300">Nome</label>
                <input name="firstName" required className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-zinc-50" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-300">Sobrenome</label>
                <input name="lastName" required className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-zinc-50" />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-zinc-300">E-mail</label>
                <input name="email" type="email" required className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-zinc-50" />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-zinc-300">Senha temporaria</label>
                <input name="temporaryPassword" type="password" minLength={8} required className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-zinc-50" />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="mt-2 inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Criar usuario
                </button>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}