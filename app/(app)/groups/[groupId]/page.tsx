import { GroupMemberRole, GroupType } from "@/app/generated/prisma/enums";
import { requireGroupMember } from "@/lib/groups/authorization";

type GroupDetailsPageProps = {
  params: Promise<{
    groupId: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    dateStyle: "short",
  }).format(date);
}

export default async function GroupDetailsPage({ params }: GroupDetailsPageProps) {
  const { groupId } = await params;
  const { group, membership } = await requireGroupMember(groupId);
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
          <h2 className="text-lg font-semibold">Membros ativos</h2>
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
                <span className="text-sm font-medium text-emerald-300">
                  {member.role === GroupMemberRole.ADMIN ? "ADMIN" : "MEMBER"}
                </span>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
