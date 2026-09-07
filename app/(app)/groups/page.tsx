import { GroupMemberRole, GroupType } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserProfile } from "@/lib/auth/session";
import { createGroup } from "./actions";

type SearchParams = {
  status?: string | string[];
  error?: string | string[];
};

const statusMessages: Record<string, string> = {
  created: "Grupo criado com sucesso.",
};

const errorMessages: Record<string, string> = {
  INVALID_NAME: "Informe um nome entre 1 e 80 caracteres.",
  INVALID_DESCRIPTION: "A descricao deve ter no maximo 500 caracteres.",
  INVALID_TYPE: "Selecione um tipo de grupo valido.",
  INVALID_START_DATE: "Informe uma data inicial valida.",
  INVALID_END_DATE: "Informe uma data final valida.",
  END_DATE_BEFORE_START: "A data final nao pode ser anterior a data inicial.",
  CREATE_FAILED: "Nao foi possivel criar o grupo. Tente novamente.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    dateStyle: "short",
  }).format(date);
}

function isCurrentGroup(group: {
  archivedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
}) {
  const now = new Date();

  return (
    !group.archivedAt &&
    (!group.startDate || group.startDate <= now) &&
    (!group.endDate || group.endDate >= now)
  );
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireCurrentUserProfile();
  const params = await searchParams;
  const status = firstValue(params.status);
  const error = firstValue(params.error);

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: profile.id,
      leftAt: null,
    },
    include: {
      group: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  const groups = memberships.sort((first, second) => {
    const currentDifference = Number(isCurrentGroup(second.group)) - Number(isCurrentGroup(first.group));

    if (currentDifference !== 0) {
      return currentDifference;
    }

    return second.group.createdAt.getTime() - first.group.createdAt.getTime();
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
            <h1 className="text-3xl font-semibold">Grupos</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Crie e acompanhe os grupos dos quais voce participa.
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
          <h2 className="text-lg font-semibold">Novo grupo</h2>
          <form action={createGroup} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
              <span>Nome</span>
              <input
                name="name"
                maxLength={80}
                required
                className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50 outline-none focus:border-emerald-400"
              />
            </label>

            <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
              <span>Descricao</span>
              <textarea
                name="description"
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50 outline-none focus:border-emerald-400"
              />
            </label>

            <label className="space-y-2 text-sm text-zinc-300">
              <span>Tipo</span>
              <select
                name="type"
                defaultValue={GroupType.PERMANENT}
                className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50"
              >
                <option value={GroupType.PERMANENT}>Permanente</option>
                <option value={GroupType.EVENT}>Evento</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-zinc-300">
              <span>Data inicial</span>
              <input
                name="startDate"
                type="date"
                className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50"
              />
            </label>

            <label className="space-y-2 text-sm text-zinc-300">
              <span>Data final</span>
              <input
                name="endDate"
                type="date"
                className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50"
              />
            </label>

            <button
              type="submit"
              className="h-11 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 sm:col-span-2"
            >
              Criar grupo
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Meus grupos</h2>
          {groups.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-400">
              Voce ainda nao participa de nenhum grupo.
            </p>
          ) : (
            groups.map((membership) => {
              const group = membership.group;
              const startDate = formatDate(group.startDate);
              const endDate = formatDate(group.endDate);

              return (
                <article key={group.id} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        <a className="hover:text-emerald-300" href={`/groups/${group.id}`}>
                          {group.name}
                        </a>
                      </h3>
                      {group.description ? <p className="mt-1 text-sm text-zinc-400">{group.description}</p> : null}
                    </div>
                    <span className="text-sm font-medium text-emerald-300">
                      {membership.role === GroupMemberRole.ADMIN ? "ADMIN" : "MEMBER"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                    <span>{group.type === GroupType.EVENT ? "Evento" : "Permanente"}</span>
                    {startDate ? <span>Inicio: {startDate}</span> : null}
                    {endDate ? <span>Fim: {endDate}</span> : null}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </section>
    </main>
  );
}
