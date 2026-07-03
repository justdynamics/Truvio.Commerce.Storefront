import { stopImpersonationAction } from "components/auth/actions";
import { getSession } from "lib/dynamicweb/auth";

/** Banner shown while a CSR is impersonating a buyer (server component). */
export async function ActingBanner() {
  const session = await getSession();
  if (!session.actingAs) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span>
        You are acting as <strong>{session.actingAs.name}</strong> (customer{" "}
        {session.actingAs.customerNumber}) on behalf of{" "}
        {session.baseUser?.name}.
      </span>
      <form action={stopImpersonationAction}>
        <button className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-50">
          Stop impersonating
        </button>
      </form>
    </div>
  );
}
