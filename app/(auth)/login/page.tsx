import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/session";
import { signInWithPassword } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "invalid-credentials": "Email ou senha invalidos.",
  "missing-credentials": "Informe email e senha.",
  "profile-not-found": "Perfil do PiggyFlow nao encontrado.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getAuthUser();

  if (user) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  const message = error ? errorMessages[error] : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-50">
      <section className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
          <h1 className="text-3xl font-semibold">Entrar</h1>
          <p className="text-sm leading-6 text-zinc-400">
            Acesse sua conta para continuar para o painel financeiro.
          </p>
        </div>

        <form action={signInWithPassword} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Email</span>
            <input
              className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Senha</span>
            <input
              className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {message ? <p className="text-sm text-red-300">{message}</p> : null}

          <button
            className="h-11 w-full rounded-md bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            type="submit"
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}