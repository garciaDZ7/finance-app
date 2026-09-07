"use client";

type RemoveMemberButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  groupId: string;
  userId: string;
};

export function RemoveMemberButton({ action, groupId, userId }: RemoveMemberButtonProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm("Remover este membro do grupo?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="h-9 rounded-md border border-rose-900 px-3 text-sm font-medium text-rose-300 hover:border-rose-500"
      >
        Remover
      </button>
    </form>
  );
}
