import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/session";
import { updatePassword } from "./actions";

type SetPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "password-mismatch": "As senhas nao conferem.",
  "update-failed": "Nao foi possivel definir a senha.",
  "profile-update-failed": "Senha definida, mas nao foi possivel atualizar o perfil. Tente salvar novamente.",
  "weak-password": "Use uma senha com pelo menos 8 caracteres.",
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await searchParams;
  const message = error ? errorMessages[error] : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-50">
      <section className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
          <h1 className="text-3xl font-semibold">Definir senha</h1>
          <p className="text-sm leading-6 text-zinc-400">
            Crie sua senha para concluir o acesso ao PiggyFlow.
          </p>
        </div>

        <form action={updatePassword} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Nova senha</span>
            <input
              className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Confirmar senha</span>
            <input
              className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-50 outline-none transition focus:border-emerald-400"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {message ? <p className="text-sm text-red-300">{message}</p> : null}

          <button
            className="h-11 w-full rounded-md bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            type="submit"
          >
            Salvar senha
          </button>
        </form>
      </section>
    </main>
  );
}