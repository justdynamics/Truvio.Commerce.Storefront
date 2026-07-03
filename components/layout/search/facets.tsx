import { Facet } from "lib/dynamicweb/types";
import Link from "next/link";

/**
 * Facet controls for the PLP. Each option toggles its facet's queryParameter in
 * the URL (single-select per facet); other params (q, sort, sibling facets) are
 * preserved. Server component — no client JS needed.
 */
export function Facets({
  facets,
  searchParams,
}: {
  facets: Facet[];
  searchParams: Record<string, string | undefined>;
}) {
  if (!facets.length) return null;

  const buildHref = (param: string, value: string, selected: boolean) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== param) next.set(k, v);
    }
    if (!selected) next.set(param, value);
    const qs = next.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mb-6 space-y-5">
      {facets.map((facet) => (
        <div key={facet.queryParameter}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {facet.name}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {facet.options.slice(0, 24).map((o) => (
              <li key={o.value}>
                <Link
                  href={buildHref(facet.queryParameter, o.value, o.selected)}
                  prefetch={false}
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs " +
                    (o.selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300")
                  }
                >
                  {o.label}
                  <span className={o.selected ? "opacity-80" : "text-neutral-400"}>
                    {o.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
