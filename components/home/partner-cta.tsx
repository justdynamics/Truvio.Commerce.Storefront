import Link from "next/link";

export function PartnerCta() {
  return (
    <section className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
      <div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-10 sm:flex-row sm:items-center sm:px-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold">Become a partner today</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Join our network of trusted dealers and distributors. Sign in to see
            your contract pricing, place orders, and reorder in a few clicks.
          </p>
        </div>
        <Link
          href="/login"
          className="shrink-0 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Sign in to your account
        </Link>
      </div>
    </section>
  );
}
