"use client";

import clsx from "clsx";
import type { CollectionTreeNode } from "lib/dynamicweb";
import { createUrl } from "lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Desktop nested collections nav: bold umbrella parents, indented children,
// with active-path highlighting. Rendered from the curated group hierarchy.
export function CollectionTree({ tree }: { tree: CollectionTreeNode[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.delete("q");

  const NavLink = ({
    title,
    path,
    bold,
  }: {
    title: string;
    path: string;
    bold?: boolean;
  }) => {
    const active = pathname === path;
    return (
      <Link
        href={createUrl(path, params)}
        className={clsx(
          "block w-full text-sm underline-offset-4 hover:underline dark:hover:text-neutral-100",
          bold && "font-semibold",
          active && "underline",
        )}
      >
        {title}
      </Link>
    );
  };

  return (
    <ul className="hidden md:block">
      <li className="mt-2">
        <NavLink title="All" path="/search" />
      </li>
      {tree.map((node) => (
        <li key={node.handle} className="mt-4">
          <NavLink title={node.title} path={node.path} bold />
          {node.children.length ? (
            <ul className="ml-2 mt-1 border-l border-neutral-200 pl-3 dark:border-neutral-800">
              {node.children.map((child) => (
                <li key={child.handle} className="mt-1.5">
                  <NavLink title={child.title} path={child.path} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
