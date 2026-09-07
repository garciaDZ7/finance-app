import { CategoryScope, TransactionType } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";
import { createTransaction, deleteTransaction, updateTransaction } from "./actions";

type SearchParams = {
  status?: string | string[];
  error?: string | string[];
};

const statusMessages: Record<string, string> = {
  created: "Transacao criada com sucesso.",
  updated: "Transacao atualizada com sucesso.",
  deleted: "Transacao excluida com sucesso.",
};

const errorMessages: Record<string, string> = {
  INVALID_TYPE: "Selecione receita ou despesa.",
  INVALID_CATEGORY: "Selecione uma categoria pessoal valida.",
  INVALID_AMOUNT: "Informe um valor maior que zero com no maximo duas casas decimais.",
  INVALID_DATE: "Informe uma data valida.",
  INVALID_DESCRIPTION: "Informe uma descricao de ate 200 caracteres.",
  TRANSACTION_NOT_FOUND: "Transacao nao encontrada ou sem permissao para altera-la.",
  DELETE_FAILED: "Nao foi possivel excluir a transacao. Ela pode estar relacionada a outro recurso.",
  UNEXPECTED_ERROR: "Nao foi possivel salvar a transacao. Tente novamente.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    dateStyle: "short",
  }).format(date);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireCurrentUserProfile();
  const params = await searchParams;
  const status = firstValue(params.status);
  const error = firstValue(params.error);

  const [categories, transactions] = await Promise.all([
    prisma.category.findMany({
      where: {
        createdById: profile.id,
        scope: CategoryScope.PERSONAL,
        groupId: null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        responsibleUserId: profile.id,
        groupId: null,
        category: {
          createdById: profile.id,
          scope: CategoryScope.PERSONAL,
          groupId: null,
        },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        amount: true,
        occurredAt: true,
        description: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
            <h1 className="text-3xl font-semibold">Transacoes</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Registre suas receitas e despesas pessoais.
            </p>
          </div>
          <a className="text-sm font-medium text-zinc-300 hover:text-white" href="/dashboard">
            Voltar
          </a>
        </header>

        {status && statusMessages[status] ? (
          <p className="rounded-md bg-emerald-800/30 px-4 py-3 text-sm text-emerald-200">
            {statusMessages[status]}
          </p>
        ) : null}

        {error && errorMessages[error] ? (
          <p className="rounded-md bg-rose-800/30 px-4 py-3 text-sm text-rose-200">
            {errorMessages[error]}
          </p>
        ) : null}

        <section className="rounded-md border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-lg font-semibold">Nova transacao</h2>
          {categories.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">
              Crie uma categoria pessoal antes de registrar uma transacao.
            </p>
          ) : (
            <form action={createTransaction} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Tipo</span>
                <select name="type" defaultValue={TransactionType.EXPENSE} className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50">
                  <option value={TransactionType.INCOME}>Receita</option>
                  <option value={TransactionType.EXPENSE}>Despesa</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-zinc-300">
                <span>Categoria</span>
                <select name="categoryId" required defaultValue="" className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50">
                  <option value="" disabled>Selecione uma categoria</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>

              <label className="space-y-2 text-sm text-zinc-300">
                <span>Valor</span>
                <input name="amount" type="text" inputMode="decimal" placeholder="0.00" required className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50" />
              </label>

              <label className="space-y-2 text-sm text-zinc-300">
                <span>Data</span>
                <input name="occurredAt" type="date" required className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50" />
              </label>

              <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
                <span>Descricao</span>
                <input name="description" maxLength={200} required className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50" />
              </label>

              <button type="submit" className="h-11 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 sm:col-span-2">
                Criar transacao
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Seus lancamentos</h2>
          {transactions.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-400">
              Nenhuma transacao pessoal cadastrada.
            </p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
                <form action={updateTransaction} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="transactionId" value={transaction.id} />
                  <label className="space-y-1 text-sm text-zinc-300">
                    <span>Tipo</span>
                    <select name="type" defaultValue={transaction.type} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50">
                      <option value={TransactionType.INCOME}>Receita</option>
                      <option value={TransactionType.EXPENSE}>Despesa</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-zinc-300">
                    <span>Categoria</span>
                    <select name="categoryId" defaultValue={transaction.category?.id ?? ""} required className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50">
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-zinc-300">
                    <span>Valor</span>
                    <input name="amount" type="text" inputMode="decimal" defaultValue={String(transaction.amount)} required className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50" />
                  </label>
                  <label className="space-y-1 text-sm text-zinc-300">
                    <span>Data</span>
                    <input name="occurredAt" type="date" defaultValue={formatDateInput(transaction.occurredAt)} required className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50" />
                  </label>
                  <label className="space-y-1 text-sm text-zinc-300 sm:col-span-2">
                    <span>Descricao</span>
                    <input name="description" defaultValue={transaction.description} maxLength={200} required className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50" />
                  </label>
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <p className={transaction.type === TransactionType.INCOME ? "text-sm font-medium text-emerald-300" : "text-sm font-medium text-rose-300"}>
                      {transaction.type === TransactionType.INCOME ? "+" : "-"}{String(transaction.amount)} em {formatDate(transaction.occurredAt)}
                    </p>
                    <div className="flex gap-2">
                      <button type="submit" className="h-10 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-200 hover:border-zinc-400">Salvar</button>
                    </div>
                  </div>
                </form>
                <form action={deleteTransaction} className="mt-2 flex justify-end">
                  <input type="hidden" name="transactionId" value={transaction.id} />
                  <button type="submit" className="h-10 rounded-md border border-rose-900 px-3 text-sm font-medium text-rose-300 hover:border-rose-500">Excluir</button>
                </form>
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
