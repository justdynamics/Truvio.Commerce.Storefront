"use client";

import { loginAction } from "components/auth/actions";
import { useActionState } from "react";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-300">Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          defaultValue="buyer"
          required
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-300">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-neutral-500">
        B2B demo buyer: <code>buyer</code>. CSR: <code>csr</code>.
      </p>
    </form>
  );
}
