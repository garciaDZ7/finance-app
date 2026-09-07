import { requireCurrentUserProfile } from "@/lib/auth/session";
import { signOut, createUser } from "./actions";
import { UserRole } from "@/app/generated/prisma/enums";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireCurrentUserProfile();
  const params = await searchParams;

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