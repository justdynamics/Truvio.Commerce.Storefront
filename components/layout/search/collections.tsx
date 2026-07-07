import clsx from "clsx";
import { Suspense } from "react";

import { getCollectionTree } from "lib/dynamicweb";
import { CollectionTree } from "./collection-tree";
import FilterItemDropdown from "./filter/dropdown";

async function CollectionList() {
  const tree = await getCollectionTree();
  // Mobile: flatten the tree into a single dropdown list (children prefixed).
  const flat = [
    { title: "All", path: "/search" },
    ...tree.flatMap((n) => [
      { title: n.title, path: n.path },
      ...n.children.map((c) => ({ title: `– ${c.title}`, path: c.path })),
    ]),
  ];
  return (
    <nav>
      <h3 className="hidden text-xs text-neutral-500 md:block dark:text-neutral-400">
        Collections
      </h3>
      <CollectionTree tree={tree} />
      <ul className="md:hidden">
        <FilterItemDropdown list={flat} />
      </ul>
    </nav>
  );
}

const skeleton = "mb-3 h-4 w-5/6 animate-pulse rounded-sm";
const activeAndTitles = "bg-neutral-800 dark:bg-neutral-300";
const items = "bg-neutral-400 dark:bg-neutral-700";

export default function Collections() {
  return (
    <Suspense
      fallback={
        <div className="col-span-2 hidden h-[400px] w-full flex-none py-4 lg:block">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <CollectionList />
    </Suspense>
  );
}
