import { GroupMemberRole, GroupType } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireGroupMember } from "@/lib/groups/authorization";
import { addGroupMember, leaveGroup, removeGroupMember } from "../actions";
import { RemoveMemberButton } from "./member-actions";

type SearchParams = {
  status?: string | string[];
  error?: string | string[];
};

type GroupDetailsPageProps = {
  params: Promise<{
    groupId: string;
  }>;
  searchParams: Promise<SearchParams>;
};

const statusMessages: Record<string, string> = {
  "member-added": "Membro adicionado com sucesso.",
  "member-removed": "Membro removido com sucesso.",
  "group-left": "Voce saiu do grupo.",
};

const errorMessages: Record<string, string> = {
  INVALID_MEMBER: "Usuario invalido ou nao encontrado.",
  CANNOT_ADD_SELF: "O administrador nao pode adicionar a si mesmo.",
  ALREADY_MEMBER: "Este usuario ja faz parte do grupo.",
  MEMBER_NOT_ACTIVE: "Este usuario nao e membro ativo do grupo.",
  LAST_ADMIN: "Nao e possivel remover ou sair enquanto voce for o unico administrador.",
  MEMBER_UPDATE_FAILED: "Nao foi possivel atualizar os membros. Tente novamente.",
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

export default async function GroupDetailsPage({ params, searchParams }: GroupDetailsPageProps) {
  const { groupId } = await params;
  const { profile, group, membership } = await requireGroupMember(groupId);
  const paramsValue = await searchParams;
  const status = firstValue(paramsValue.status);
  const error = firstValue(paramsValue.error);
  const isAdmin = membership.role === GroupMemberRole.ADMIN;
  const activeMemberIds = group.members.map((member) => member.userId);
  const availableUsers = isAdmin
    ? await prisma.user.findMany({
        where: {
          id: {
            notIn: [profile.id, ...activeMemberIds],
          },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      })
    : [];
  const startDate = formatDate(group.startDate);
  const endDate = formatDate(group.endDate);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <p className="text-sm font-medium text-emerald-300">PiggyFlow</p>
            <h1 className="text-3xl font-semibold">{group.name}</h1>
            {group.description ? <p className="mt-2 text-sm text-zinc-400">{group.description}</p> : null}
          </div>
          <a className="text-sm font-medium text-zinc-300 hover:text-white" href="/groups">
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
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
            <span>{group.type === GroupType.EVENT ? "Evento" : "Permanente"}</span>
            {startDate ? <span>Inicio: {startDate}</span> : null}
            {endDate ? <span>Fim: {endDate}</span> : null}
            <span className="font-medium text-emerald-300">
              Voce e {membership.role === GroupMemberRole.ADMIN ? "ADMIN" : "MEMBER"}
            </span>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Membros ativos</h2>
            {!isAdmin ? (
              <form action={leaveGroup}>
                <input type="hidden" name="groupId" value={groupId} />
                <button
                  type="submit"
                  className="h-9 rounded-md border border-rose-900 px-3 text-sm font-medium text-rose-300 hover:border-rose-500"
                >
                  Sair do grupo
                </button>
              </form>
            ) : null}
          </div>

          {isAdmin ? (
            <section className="rounded-md border border-zinc-800 bg-zinc-900/40 p-5">
              <h3 className="font-semibold">Adicionar membro</h3>
              {availableUsers.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">
                  Nao ha usuarios disponiveis para adicionar.
                </p>
              ) : (
                <form action={addGroupMember} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="groupId" value={groupId} />
                  <select
                    name="userId"
                    required
                    defaultValue=""
                    className="h-10 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50"
                  >
                    <option value="" disabled>Selecione um usuario</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} - {user.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Adicionar
                  </button>
                </form>
              )}
            </section>
          ) : null}

          {group.members.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-400">
              Nenhum membro ativo encontrado.
            </p>
          ) : (
            group.members.map((member) => (
              <article key={member.id} className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-zinc-100">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="text-sm text-zinc-400">{member.user.email}</p>
                  <p className="mt-1 text-xs text-zinc-500">Desde {formatDate(member.joinedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-emerald-300">
                    {member.role === GroupMemberRole.ADMIN ? "ADMIN" : "MEMBER"}
                  </span>
                  {isAdmin ? (
                    <RemoveMemberButton
                      action={removeGroupMember}
                      groupId={groupId}
                      userId={member.userId}
                    />
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
