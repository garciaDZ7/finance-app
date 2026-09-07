import { CategoryScope } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";
import { createCategory, deleteCategory, updateCategory } from "./actions";

type SearchParams = {
  status?: string | string[];
  error?: string | string[];
};

const statusMessages: Record<string, string> = {
  created: "Categoria criada com sucesso.",
  updated: "Categoria atualizada com sucesso.",
  deleted: "Categoria excluida com sucesso.",
};

const errorMessages: Record<string, string> = {
  INVALID_NAME: "Informe um nome entre 1 e 80 caracteres.",
  DUPLICATE_NAME: "Voce ja possui uma categoria pessoal com esse nome.",
  CATEGORY_NOT_FOUND: "Categoria nao encontrada ou sem permissao para altera-la.",
  DELETE_FAILED: "Nao foi possivel excluir esta categoria.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireCurrentUserProfile();
  const params = await searchParams;
  const status = firstValue(params.status);
  const error = firstValue(params.error);

  const categories = await prisma.category.findMany({
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
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
            <h1 className="text-3xl font-semibold">Categorias</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Gerencie suas categorias pessoais.
            </p>
          </div>
          <a
            className="text-sm font-medium text-zinc-300 hover:text-white"
            href="/dashboard"
          >
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
          <h2 className="text-lg font-semibold">Nova categoria</h2>
          <form action={createCategory} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="name"
              maxLength={80}
              required
              placeholder="Ex.: Alimentacao"
              className="h-11 flex-1 rounded-md border border-zinc-700 bg-transparent px-3 text-sm text-zinc-50 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="h-11 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Criar categoria
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Suas categorias</h2>
          {categories.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-400">
              Nenhuma categoria pessoal cadastrada.
            </p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center"
              >
                <form action={updateCategory} className="flex flex-1 gap-3">
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input
                    name="name"
                    defaultValue={category.name}
                    maxLength={80}
                    required
                    className="h-10 min-w-0 flex-1 rounded-md border border-zinc-700 bg-transparent px-3 text-sm text-zinc-50 outline-none focus:border-emerald-400"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-200 hover:border-zinc-400"
                  >
                    Salvar
                  </button>
                </form>
                <form action={deleteCategory}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <button
                    type="submit"
                    className="h-10 rounded-md border border-rose-900 px-3 text-sm font-medium text-rose-300 hover:border-rose-500"
                  >
                    Excluir
                  </button>
                </form>
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
