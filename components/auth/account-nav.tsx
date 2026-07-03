import { logoutAction } from "components/auth/actions";
import { getSession } from "lib/dynamicweb/auth";
import Link from "next/link";

/** Session-aware account control for the navbar (server component). */
export async function AccountNav() {
  const session = await getSession();

  if (!session.isAuthenticated) {
    return (
      <Link
        href="/login"
        prefetch={false}
        className="ml-4 text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="ml-4 flex items-center gap-3 text-sm">
      <Link
        href="/account"
        prefetch={false}
        className="text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200"
      >
        {session.actingAs ? session.actingAs.name : session.baseUser?.name || "Account"}
      </Link>
      <form action={logoutAction}>
        <button className="text-neutral-500 underline-offset-4 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
