import { TAGS } from "lib/constants";
import { revalidateTag } from "next/cache";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  DW_AREA_ID,
  DW_COUNTRY_CODE,
  DW_LANGUAGE_ID,
  DW_MEDIA_BASE,
  DW_QUERY_NAME,
  DW_REPOSITORY_NAME,
  DW_SHOP_ID,
  dwDelete,
  dwGet,
  dwPatch,
  dwPost,
  localeParams,
} from "./dwapi";
import { getEffectiveToken } from "./auth";
import {
  Address,
  Cart,
  CartItem,
  Collection,
  Facet,
  Image,
  Menu,
  Money,
  Order,
  OrderLine,
  Page,
  Product,
  ProductOption,
  ProductVariant,
  SEO,
} from "./types";

// ---------------------------------------------------------------------------
// DW Delivery-API view-model shapes (loose — only the fields the reshapers use)
// ---------------------------------------------------------------------------

type DwPrice = {
  price?: number;
  priceWithVat?: number;
  priceWithoutVat?: number;
  vat?: number;
  currencyCode?: string;
};

type DwProduct = {
  id: string;
  variantId?: string;
  name?: string;
  title?: string;
  number?: string;
  shortDescription?: string;
  longDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string;
  updated?: string;
  active?: boolean;
  neverOutOfstock?: boolean;
  stockLevel?: number;
  price?: DwPrice;
  imagePatternImages?: Array<{ value?: string; name?: string }>;
  assetCategories?: Array<{
    assets?: Array<{ value?: string; name?: string }>;
  }>;
  groups?: Array<{ id: string; name?: string }>;
};

type DwGroup = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  metaDescription?: string;
};

type DwSearchResponse = {
  products: DwProduct[];
  pageSize: number;
  pageCount: number;
  currentPage: number;
  totalProductsCount: number;
  facetGroups?: Array<{
    name: string;
    facets: Array<{
      name: string;
      queryParameter: string;
      facetField: string;
      optionCount: number;
      options: Array<{
        name: string;
        label: string;
        value: string;
        count: number;
        selected: boolean;
      }>;
    }>;
  }>;
};

type DwVariantNode = {
  variantID?: string;
  optionID?: string;
  optionName?: string;
  optionColor?: string;
  variantInfoGroupId?: string;
  variantInfoGroupName?: string;
  price?: DwPrice;
  productStock?: number;
  variantInfo?: DwVariantNode[];
};

type DwCartPrice = { price?: number; priceFormatted?: string; currencyCode?: string };
type DwOrderLine = {
  id?: string;
  productId?: string;
  productVariantId?: string;
  productName?: string;
  productNumber?: string;
  quantity?: number;
  price?: DwCartPrice;
  unitPrice?: DwCartPrice;
};
type DwCart = {
  id?: string;
  secret?: string;
  currencyCode?: string;
  orderLines?: DwOrderLine[];
  price?: DwCartPrice;
  totalTaxes?: DwCartPrice;
  totalPriceBeforeFeesAndTaxes?: DwCartPrice;
};

type DwNavNode = {
  name?: string;
  link?: string;
  friendlyUrl?: string;
  showInMenu?: boolean;
  level?: number;
  pageId?: number;
  nodes?: DwNavNode[];
};

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const DEFAULT_CURRENCY = process.env.DW_CURRENCY_CODE || "EUR";

// Catalog ships with no product images (imagePatternImages/assetCategories empty
// across all 378 products). Use a same-origin placeholder so next/image renders.
const PLACEHOLDER_IMAGE: Image = {
  url: "/placeholder.svg",
  altText: "Product image placeholder",
  width: 1000,
  height: 1000,
};

const MERCH_SEP = "::";

const encodeMerchandiseId = (productId: string, variantId?: string): string =>
  variantId ? `${productId}${MERCH_SEP}${variantId}` : productId;

const decodeMerchandiseId = (
  merchandiseId: string
): { productId: string; variantId: string } => {
  const parts = merchandiseId.split(MERCH_SEP);
  return { productId: parts[0] ?? "", variantId: parts[1] ?? "" };
};

const stripHtml = (html?: string): string =>
  (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const money = (amount: number | undefined, currency?: string): Money => ({
  amount: (amount ?? 0).toString(),
  currencyCode: currency || DEFAULT_CURRENCY,
});

const productPrice = (p?: DwPrice): Money =>
  money(p?.priceWithVat ?? p?.price ?? 0, p?.currencyCode);

const mediaUrl = (value?: string): string => {
  if (!value) return PLACEHOLDER_IMAGE.url;
  if (/^https?:\/\//i.test(value)) return value;
  return `${DW_MEDIA_BASE}${value.startsWith("/") ? value : `/${value}`}`;
};

const productImages = (p: DwProduct): Image[] => {
  const urls: string[] = [];
  for (const img of p.imagePatternImages || []) {
    if (img?.value) urls.push(mediaUrl(img.value));
  }
  for (const cat of p.assetCategories || []) {
    for (const a of cat?.assets || []) {
      if (a?.value) urls.push(mediaUrl(a.value));
    }
  }
  if (!urls.length) return [PLACEHOLDER_IMAGE];
  return urls.map((url) => ({
    url,
    altText: p.name || p.title || "Product image",
    width: 1000,
    height: 1000,
  }));
};

// ---------------------------------------------------------------------------
// Reshapers
// ---------------------------------------------------------------------------

const productSeo = (p: DwProduct): SEO => ({
  title: p.metaTitle || p.name || p.title || "",
  description: p.metaDescription || stripHtml(p.shortDescription) || "",
});

const availableForSale = (p: DwProduct): boolean =>
  Boolean(p.active) && (Boolean(p.neverOutOfstock) || (p.stockLevel ?? 0) > 0);

/** A product with no variant matrix — one default merchandise line. */
const defaultVariant = (p: DwProduct): ProductVariant => ({
  id: encodeMerchandiseId(p.id),
  title: "Default Title",
  availableForSale: availableForSale(p),
  selectedOptions: [],
  price: productPrice(p.price),
});

/**
 * Walk the nested DW `/variants/{id}` tree into flat Vercel options + variants.
 * Each tree level is a variant group ("Colors", "Shoe size"); leaves are the
 * full option combinations. Leaf variant id = DW option ids joined with '.'
 * (matches the `variantId` shape returned by product search, e.g. "VO3.VO49").
 */
const reshapeVariantTree = (
  productId: string,
  productActive: boolean,
  productPriceModel: DwPrice | undefined,
  groups: DwVariantNode[],
  topGroupName: string
): { options: ProductOption[]; variants: ProductVariant[] } => {
  const optionMap = new Map<string, Set<string>>();
  const variants: ProductVariant[] = [];

  const walk = (
    node: DwVariantNode,
    groupName: string,
    selected: { name: string; value: string }[],
    ids: string[]
  ) => {
    const value = node.optionName || node.optionID || node.variantID || "";
    const optId = node.optionID || node.variantID || value;
    if (groupName) {
      if (!optionMap.has(groupName)) optionMap.set(groupName, new Set());
      optionMap.get(groupName)!.add(value);
    }
    const nextSelected = groupName
      ? [...selected, { name: groupName, value }]
      : selected;
    const nextIds = optId ? [...ids, optId] : ids;

    const childGroupName = node.variantInfoGroupName || "";
    const children = node.variantInfo || [];
    if (children.length) {
      for (const child of children) walk(child, childGroupName, nextSelected, nextIds);
    } else {
      // leaf
      variants.push({
        id: encodeMerchandiseId(productId, nextIds.join(".")),
        title: nextSelected.map((s) => s.value).join(" / ") || "Default Title",
        availableForSale: productActive,
        selectedOptions: nextSelected,
        price:
          node.price && node.price.price
            ? productPrice(node.price)
            : productPrice(productPriceModel),
      });
    }
  };

  // `groups` is the top-level list of first-dimension options; their shared
  // group name is the root's `variantInfoGroupName` (passed in as topGroupName),
  // NOT groups[0]'s (which points at the SECOND dimension's group).
  for (const g of groups) walk(g, topGroupName, [], []);

  const options: ProductOption[] = [...optionMap.entries()].map(
    ([name, values], i) => ({
      id: `opt-${i}-${name}`,
      name,
      values: [...values],
    })
  );

  return { options, variants };
};

const reshapeProductBase = (p: DwProduct): Product => {
  const handle = p.number || p.id;
  const price = productPrice(p.price);
  const images = productImages(p);
  return {
    id: p.id,
    handle,
    availableForSale: availableForSale(p),
    title: p.name || p.title || handle,
    description: stripHtml(p.shortDescription) || stripHtml(p.longDescription),
    descriptionHtml: p.longDescription || p.shortDescription || "",
    options: [],
    priceRange: { minVariantPrice: price, maxVariantPrice: price },
    variants: [defaultVariant(p)],
    featuredImage: images[0] || PLACEHOLDER_IMAGE,
    images,
    seo: productSeo(p),
    tags: (p.keywords || "").split(",").map((t) => t.trim()).filter(Boolean),
    updatedAt: p.updated || new Date().toISOString(),
  };
};

const reshapeCollection = (g: DwGroup): Collection => ({
  handle: g.id,
  title: g.name || g.title || g.id,
  description: stripHtml(g.description),
  seo: {
    title: g.name || g.id,
    description: g.metaDescription || stripHtml(g.description),
  },
  path: `/search/${g.id}`,
  updatedAt: new Date().toISOString(),
});

const reshapeCartLine = (l: DwOrderLine): CartItem => {
  const amount = l.price?.price ?? 0;
  return {
    id: l.id,
    quantity: l.quantity ?? 0,
    cost: { totalAmount: money(amount, l.price?.currencyCode) },
    merchandise: {
      id: encodeMerchandiseId(l.productId || "", l.productVariantId || ""),
      title: l.productName || "",
      selectedOptions: [],
      product: {
        id: l.productId || "",
        handle: l.productNumber || l.productId || "",
        title: l.productName || "",
        featuredImage: PLACEHOLDER_IMAGE,
      },
    },
  };
};

const reshapeCart = (c: DwCart): Cart => {
  const lines = (c.orderLines || []).map(reshapeCartLine);
  const currency = c.price?.currencyCode || DEFAULT_CURRENCY;
  const total = c.price?.price ?? 0;
  const tax = c.totalTaxes?.price ?? 0;
  const subtotal = c.totalPriceBeforeFeesAndTaxes?.price ?? total - tax;
  return {
    id: c.secret,
    // Handoff-only: DW headless has no hosted checkout page in this baseline.
    // Point at the reachable Delivery-API checkout endpoint for the cart secret.
    checkoutUrl: `${DW_MEDIA_BASE}/dwapi/ecommerce/carts/${c.secret}/checkout`,
    cost: {
      subtotalAmount: money(subtotal, currency),
      totalAmount: money(total, currency),
      totalTaxAmount: money(tax, currency),
    },
    lines,
    totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
  };
};

/**
 * DW nav `link` values are backend paths (`/headless/*`) that 404 as Next routes.
 * Translate them to storefront routes: catalog-ish nodes → `/search`, home → `/`,
 * everything else → a single-segment content-page slug the `/[page]` route resolves
 * via `/content/pages/url`. Heuristic but eliminates the cosmetic prefetch 404s.
 */
export const translateNavPath = (raw?: string): string => {
  if (!raw || raw === "/") return "/";
  let p = raw.trim();
  if (/^https?:\/\//i.test(p)) return p; // external, leave as-is
  p = p.replace(/^\/?headless\/?/i, "/");
  if (!p.startsWith("/")) p = `/${p}`;
  const lower = p.toLowerCase();
  if (/(catalog|shop|products|store)/.test(lower)) return "/search";
  if (lower === "/" || /(^\/home$|\/frontpage)/.test(lower)) return "/";
  // keep only the last slug segment as a content page handle
  const slug = p.split("/").filter(Boolean).pop() || "";
  return slug ? `/${slug}` : "/";
};

const flattenNav = (nodes: DwNavNode[]): Menu[] =>
  (nodes || [])
    .filter((n) => n.showInMenu !== false && (n.link || n.friendlyUrl))
    .map((n) => ({
      title: n.name || "",
      path: translateNavPath(n.friendlyUrl || n.link || "/"),
    }));

// The DW headless navigation endpoint returns a FLAT, pre-order list of every
// node in the area's tree (containers + all descendants), with depth carried in
// `level` and no nested `nodes`. Extract only the direct children of a named
// container (e.g. "Header Menu" / "Footer Menu") so a menu renders its own items,
// not the entire tree. Falls back to nested `nodes` when a backend returns a real tree.
const navChildrenOf = (
  nodes: DwNavNode[],
  containerName: string
): DwNavNode[] => {
  const flat = nodes || [];
  const idx = flat.findIndex(
    (n) => (n.name || "").trim().toLowerCase() === containerName.toLowerCase()
  );
  const container = idx === -1 ? undefined : flat[idx];
  if (!container) return [];
  if (container.nodes && container.nodes.length) return container.nodes; // tree case
  const parentLevel = container.level ?? 1;
  const out: DwNavNode[] = [];
  for (let j = idx + 1; j < flat.length; j++) {
    const child = flat[j];
    if (!child) continue;
    const lvl = child.level ?? 1;
    if (lvl <= parentLevel) break; // reached a sibling/uncle → subtree ended
    if (lvl === parentLevel + 1) out.push(child); // direct child only
  }
  return out;
};

// ---------------------------------------------------------------------------
// Product search surface (Headless repository / Products query)
// ---------------------------------------------------------------------------

const sortParams = (
  sortKey?: string,
  reverse?: boolean
): Record<string, string> => {
  const order = reverse ? "desc" : "asc";
  switch (sortKey) {
    case "PRICE":
      return { SortBy: "Price", SortOrder: order };
    case "CREATED_AT":
      return { SortBy: "Created", SortOrder: order };
    case "BEST_SELLING":
    case "RELEVANCE":
    default:
      return {};
  }
};

async function searchProducts(params: {
  q?: string;
  sku?: string;
  groupId?: string;
  sortKey?: string;
  reverse?: boolean;
  pageSize?: number;
  page?: number;
}): Promise<DwSearchResponse> {
  const query: Record<string, string | undefined> = {
    RepositoryName: DW_REPOSITORY_NAME,
    QueryName: DW_QUERY_NAME,
    ...localeParams(),
    PageSize: String(params.pageSize ?? 50),
    PageIndex: String(params.page ?? 1),
    q: params.q,
    sku: params.sku,
    GroupID: params.groupId,
    ...sortParams(params.sortKey, params.reverse),
  };
  const res = await dwGet<DwSearchResponse>(
    "/dwapi/ecommerce/products/search",
    query
  );
  if (!res.ok || !res.body || !Array.isArray(res.body.products)) {
    return {
      products: [],
      pageSize: 0,
      pageCount: 0,
      currentPage: 1,
      totalProductsCount: 0,
      facetGroups: [],
    };
  }
  return res.body;
}

// ---------------------------------------------------------------------------
// Exported provider surface (same signatures as lib/shopify)
// ---------------------------------------------------------------------------

export async function getProduct(handle: string): Promise<Product | undefined> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("hours");

  // Slug contract: handle = product `number`. Reverse-resolve via `sku`.
  let dw: DwProduct | undefined;
  const search = await searchProducts({ sku: handle, pageSize: 1 });
  dw = search.products[0];
  if (!dw) {
    // Fallback: some products' number == id, try direct detail.
    const detail = await dwGet<DwProduct>(
      `/dwapi/ecommerce/products/${encodeURIComponent(handle)}`,
      localeParams()
    );
    if (detail.ok && detail.body?.id) dw = detail.body;
  }
  if (!dw) return undefined;

  const base = reshapeProductBase(dw);

  // Expand the variant matrix (best-effort; single default variant otherwise).
  const variantsRes = await dwGet<DwVariantNode | DwVariantNode[]>(
    `/dwapi/ecommerce/variants/${encodeURIComponent(dw.id)}`,
    localeParams()
  );
  if (variantsRes.ok && variantsRes.body) {
    const raw = variantsRes.body;
    const groups = Array.isArray(raw) ? raw : raw.variantInfo || [];
    // The DW tree root carries the FIRST dimension's group name on its own
    // `variantInfoGroupName` ("Roast"); each child node's `variantInfoGroupName`
    // names its CHILDREN's group. So the top group name is the root's, not
    // groups[0]'s (which is the child pointer) — passing groups[0]'s collapses
    // dimension 1 into dimension 2 on 3-axis products.
    const rootGroupName = Array.isArray(raw)
      ? raw[0]?.variantInfoGroupName || ""
      : raw.variantInfoGroupName || "";
    if (groups.length) {
      const { options, variants } = reshapeVariantTree(
        dw.id,
        base.availableForSale,
        dw.price,
        groups,
        rootGroupName
      );
      if (variants.length) {
        base.options = options;
        base.variants = variants;
      }
    }
  }

  return base;
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("hours");

  const res = await searchProducts({
    q: query,
    reverse,
    sortKey,
    pageSize: 100,
  });
  return res.products.map(reshapeProductBase);
}

/**
 * Faceted search for the PLP: returns products plus the Delivery-API facet groups
 * (Group → GroupID, Price → PriceRange; Manufacturer is empty in this catalog).
 * Selected facet values are echoed back with `selected: true` for the UI.
 */
export async function getProductsWithFacets({
  query,
  sortKey,
  reverse,
  facetParams,
}: {
  query?: string;
  sortKey?: string;
  reverse?: boolean;
  // Any Delivery-API facet query parameter → value, forwarded verbatim to the
  // search endpoint. The repository's Products.query decides which are honoured
  // (e.g. GroupID, PriceRange, Roast, Origin, Grind, Brand). Kept generic so a
  // backend with different custom facets needs no provider change.
  facetParams?: Record<string, string | undefined>;
}): Promise<{ products: Product[]; facets: Facet[] }> {
  const res = await dwGet<DwSearchResponse>(
    "/dwapi/ecommerce/products/search",
    {
      RepositoryName: DW_REPOSITORY_NAME,
      QueryName: DW_QUERY_NAME,
      ...localeParams(),
      PageSize: "100",
      PageIndex: "1",
      q: query,
      ...(facetParams || {}),
      ...sortParams(sortKey, reverse),
    }
  );
  if (!res.ok || !res.body || !Array.isArray(res.body.products)) {
    return { products: [], facets: [] };
  }
  const products = res.body.products.map(reshapeProductBase);
  const facets: Facet[] = [];
  for (const g of res.body.facetGroups || []) {
    for (const f of g.facets || []) {
      if (!f.options?.length) continue; // skip empty (e.g. Manufacturer)
      facets.push({
        name: f.name,
        queryParameter: f.queryParameter,
        options: f.options.map((o) => ({
          label: o.label || o.name,
          value: o.value,
          count: o.count,
          selected: o.selected,
        })),
      });
    }
  }
  return { products, facets };
}

export async function getProductRecommendations(
  productId: string
): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("hours");

  const res = await dwGet<DwProduct[]>(
    `/dwapi/ecommerce/products/${encodeURIComponent(productId)}/related`,
    localeParams()
  );
  if (!res.ok || !Array.isArray(res.body)) return [];
  return res.body.map(reshapeProductBase);
}

export async function getCollection(
  handle: string
): Promise<Collection | undefined> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("hours");

  const res = await dwGet<DwGroup>(
    `/dwapi/ecommerce/groups/${encodeURIComponent(handle)}`,
    localeParams()
  );
  if (!res.ok || !res.body?.id) return undefined;
  return reshapeCollection(res.body);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.collections, TAGS.products);
  cacheLife("hours");

  // Homepage "hidden-*" pseudo-collections and the empty "All" handle map to an
  // unfiltered search (no DW group filter) so the storefront home renders.
  const isHidden = !collection || collection.startsWith("hidden");
  const res = await searchProducts({
    groupId: isHidden ? undefined : collection,
    reverse,
    sortKey,
    pageSize: isHidden ? 12 : 100,
  });
  return res.products.map(reshapeProductBase);
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("hours");

  const res = await dwGet<DwGroup[]>("/dwapi/ecommerce/groups", localeParams());
  const groups = res.ok && Array.isArray(res.body) ? res.body : [];
  return [
    {
      handle: "",
      title: "All",
      description: "All products",
      seo: { title: "All", description: "All products" },
      path: "/search",
      updatedAt: new Date().toISOString(),
    },
    ...groups.map(reshapeCollection),
  ];
}

export async function getMenu(handle: string): Promise<Menu[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("hours");

  const res = await dwGet<{ nodes?: DwNavNode[] }>(
    `/dwapi/frontend/navigations/${DW_AREA_ID}`,
    { LanguageId: DW_LANGUAGE_ID }
  );
  if (!res.ok || !res.body?.nodes) return [];
  // The header/footer components pass Shopify-era handles; map them to the DW
  // headless menu containers and return only that container's items (not the
  // whole flat tree of every page/section).
  const container = /footer/i.test(handle) ? "Footer Menu" : "Header Menu";
  return flattenNav(navChildrenOf(res.body.nodes, container));
}

export async function getPage(handle: string): Promise<Page> {
  const now = new Date().toISOString();
  // The Delivery API's URL→page resolver (/content/pages/url) requires the area
  // to be domain-bound and is unavailable on some hosts. Resolve the page id via
  // the navigation (always available), then fetch the page by id.
  let id: number | undefined;
  const nav = await dwGet<{ nodes?: DwNavNode[] }>(
    `/dwapi/frontend/navigations/${DW_AREA_ID}`,
    { LanguageId: DW_LANGUAGE_ID }
  );
  if (nav.ok && nav.body?.nodes) {
    const slug = handle.toLowerCase();
    const hit = nav.body.nodes.find((n) => {
      const p = (n.friendlyUrl || n.link || "")
        .toLowerCase()
        .replace(/\/+$/, "");
      return p === `/${slug}` || p.endsWith(`/${slug}`);
    });
    id = hit?.pageId;
  }
  let b:
    | { id?: number; name?: string; title?: string; description?: string }
    | undefined;
  if (id != null) {
    const detail = await dwGet<{
      id?: number;
      name?: string;
      title?: string;
      description?: string;
    }>(`/dwapi/content/pages/${id}`, { LanguageId: DW_LANGUAGE_ID });
    if (detail.ok) b = detail.body;
  }
  return {
    id: String(b?.id ?? id ?? handle),
    title: b?.title || b?.name || handle,
    handle,
    body: b?.description || "",
    bodySummary: b?.description || "",
    seo: { title: b?.title || b?.name || handle, description: b?.description || "" },
    createdAt: now,
    updatedAt: now,
  };
}

export async function getPages(): Promise<Page[]> {
  // The headless baseline exposes content via navigation; no flat page index.
  return [];
}

// ---------------------------------------------------------------------------
// Cart (opaque per-cart `secret`, stored in the `cartId` cookie)
// ---------------------------------------------------------------------------

async function fetchCart(secret: string): Promise<Cart | undefined> {
  // Carry the signed-in (or impersonatee) token so the cart binds to the user
  // and user-scoped price/permission context applies.
  const token = await getEffectiveToken();
  const res = await dwGet<DwCart>(
    `/dwapi/ecommerce/carts/${secret}`,
    localeParams(),
    token
  );
  if (!res.ok || !res.body?.secret) return undefined;
  return reshapeCart(res.body);
}

export async function createCart(): Promise<Cart> {
  const token = await getEffectiveToken();
  const res = await dwPost<DwCart>(
    "/dwapi/ecommerce/carts/create",
    {},
    localeParams(),
    token
  );
  return reshapeCart(res.body || {});
}

export async function getCart(): Promise<Cart | undefined> {
  "use cache: private";
  cacheTag(TAGS.cart);
  cacheLife("seconds");

  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) return undefined;
  return fetchCart(secret);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) throw new Error("No cart");
  const token = await getEffectiveToken();

  for (const line of lines) {
    const { productId, variantId } = decodeMerchandiseId(line.merchandiseId);
    await dwPost(
      `/dwapi/ecommerce/carts/${secret}/items`,
      {
        productId,
        productVariantId: variantId,
        productLanguageId: DW_LANGUAGE_ID,
        quantity: line.quantity,
        unitId: "",
      },
      localeParams(),
      token
    );
  }
  return (await fetchCart(secret))!;
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) throw new Error("No cart");
  const token = await getEffectiveToken();

  for (const line of lines) {
    const { productId, variantId } = decodeMerchandiseId(line.merchandiseId);
    await dwPatch(
      `/dwapi/ecommerce/carts/${secret}/items/${line.id}`,
      {
        productId,
        productVariantId: variantId,
        productLanguageId: DW_LANGUAGE_ID,
        quantity: line.quantity,
        unitId: "",
      },
      localeParams(),
      token
    );
  }
  return (await fetchCart(secret))!;
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) throw new Error("No cart");
  const token = await getEffectiveToken();

  for (const id of lineIds) {
    await dwDelete(
      `/dwapi/ecommerce/carts/${secret}/items/${id}`,
      localeParams(),
      token
    );
  }
  return (await fetchCart(secret))!;
}

// ---------------------------------------------------------------------------
// B2B / customer center (user-scoped — effective JWT threaded through)
// ---------------------------------------------------------------------------

/**
 * Per-user (contract) price for a product, resolved server-side by the buyer's
 * JWT. Returns the Money to display when signed in, or null when anonymous / no
 * override. This is the PDP/PLP price-gating proof: product 10002 resolves to the
 * buyer's contract 1399 vs the anonymous list 1599.
 */
export async function getUserPrice(
  handle: string
): Promise<{ withVat: Money; withoutVat: Money } | undefined> {
  const token = await getEffectiveToken();
  if (!token) return undefined;
  const res = await dwGet<DwSearchResponse>(
    "/dwapi/ecommerce/products/search",
    {
      RepositoryName: DW_REPOSITORY_NAME,
      QueryName: DW_QUERY_NAME,
      ...localeParams(),
      sku: handle,
      PageSize: "1",
    },
    token
  );
  const p = res.ok ? res.body?.products?.[0] : undefined;
  if (!p?.price) return undefined;
  const cur = p.price.currencyCode;
  return {
    withVat: money(p.price.priceWithVat ?? p.price.price, cur),
    withoutVat: money(p.price.priceWithoutVat ?? p.price.price, cur),
  };
}

type DwOrderLineFull = DwOrderLine & {
  productName?: string;
  productNumber?: string;
  unitPrice?: DwCartPrice;
  totalPriceWithProductDiscounts?: DwCartPrice;
};
type DwOrder = {
  id?: string;
  secret?: string;
  createdAt?: string;
  completed?: boolean;
  stateName?: string;
  customerName?: string;
  customerEmail?: string;
  price?: DwCartPrice;
  orderLines?: DwOrderLineFull[];
};

const reshapeOrderLine = (l: DwOrderLineFull): OrderLine => ({
  id: l.id || "",
  productId: l.productId || "",
  productNumber: l.productNumber || l.productId || "",
  productName: l.productName || "",
  quantity: l.quantity ?? 0,
  unitPrice: money(l.unitPrice?.price ?? 0, l.unitPrice?.currencyCode),
  totalPrice: money(
    l.totalPriceWithProductDiscounts?.price ?? l.price?.price ?? 0,
    (l.totalPriceWithProductDiscounts ?? l.price)?.currencyCode
  ),
});

const reshapeOrder = (o: DwOrder): Order => {
  const lines = (o.orderLines || []).map(reshapeOrderLine);
  return {
    id: o.id || "",
    secret: o.secret || "",
    createdAt: o.createdAt || "",
    completed: Boolean(o.completed),
    stateName: o.stateName || "",
    total: money(o.price?.price ?? 0, o.price?.currencyCode),
    customerName: o.customerName || "",
    customerEmail: o.customerEmail || "",
    lineCount: lines.length,
    lines,
  };
};

/** Order history for the signed-in (or impersonated) user. */
export async function getOrders(): Promise<Order[]> {
  const token = await getEffectiveToken();
  if (!token) return [];
  const res = await dwGet<{ orders?: DwOrder[] }>(
    "/dwapi/ecommerce/orders",
    { ShopId: DW_SHOP_ID },
    token
  );
  if (!res.ok || !Array.isArray(res.body?.orders)) return [];
  return res.body!.orders!.map(reshapeOrder);
}

/** Single order by its `secret` (the detail key, NOT the display id). */
export async function getOrder(secret: string): Promise<Order | undefined> {
  const token = await getEffectiveToken();
  if (!token) return undefined;
  const res = await dwGet<DwOrder>(
    `/dwapi/ecommerce/orders/${encodeURIComponent(secret)}`,
    { ShopId: DW_SHOP_ID },
    token
  );
  if (!res.ok || !res.body || typeof res.body !== "object" || !res.body.id) {
    return undefined;
  }
  return reshapeOrder(res.body);
}

/**
 * Reorder: copy an order's lines into the active cart (creating one if needed).
 * Mirrors Swift's reorder / addmulti behavior over the headless cart mutations.
 */
export async function reorder(orderSecret: string): Promise<Cart | undefined> {
  const order = await getOrder(orderSecret);
  if (!order) return undefined;
  let secret = (await cookies()).get("cartId")?.value;
  if (!secret) {
    const created = await createCart();
    secret = created.id;
    if (secret) (await cookies()).set("cartId", secret);
  }
  if (!secret) return undefined;
  const token = await getEffectiveToken();
  for (const l of order.lines) {
    if (!l.productId || l.quantity <= 0) continue;
    await dwPost(
      `/dwapi/ecommerce/carts/${secret}/items`,
      {
        productId: l.productId,
        productVariantId: "",
        productLanguageId: DW_LANGUAGE_ID,
        quantity: l.quantity,
        unitId: "",
      },
      localeParams(),
      token
    );
  }
  return fetchCart(secret);
}

/** Delivery + billing addresses for the signed-in user. */
export async function getAddresses(): Promise<Address[]> {
  const token = await getEffectiveToken();
  if (!token) return [];
  const res = await dwGet<Array<Record<string, string | number | boolean>>>(
    "/dwapi/users/addresses/all",
    undefined,
    token
  );
  if (!res.ok || !Array.isArray(res.body)) return [];
  return res.body.map((a) => ({
    id: String(a.id ?? ""),
    name: String(a.name ?? a.company ?? ""),
    address: String(a.address ?? ""),
    address2: String(a.address2 ?? ""),
    zip: String(a.zip ?? ""),
    city: String(a.city ?? ""),
    country: String(a.country ?? ""),
    countryCode: String(a.countryCode ?? ""),
    isBilling: Boolean(a.isBilling),
    isShipping: Boolean(a.isShipping),
  }));
}

export type CheckoutInput = {
  name: string;
  email: string;
  address: string;
  zip: string;
  city: string;
  country?: string;
};

/**
 * Place the active cart as a DW order. Stamps the shipping/customer details onto
 * the cart, then POSTs createOrder. Returns the real DW order id + secret for the
 * confirmation page. Requires a signed-in session (cart binds to the user).
 */
export async function placeOrder(
  input: CheckoutInput
): Promise<{ id: string; secret: string } | { error: string }> {
  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) return { error: "Your cart is empty." };
  const token = await getEffectiveToken();
  if (!token) return { error: "Please sign in to place an order." };

  // Stamp customer/delivery details onto the cart (PATCH is tolerant of partials).
  await dwPatch(
    `/dwapi/ecommerce/carts/${secret}`,
    {
      customerName: input.name,
      customerEmail: input.email,
      customerAddress: input.address,
      customerZip: input.zip,
      customerCity: input.city,
      customerCountry: input.country || DW_COUNTRY_CODE,
      deliveryName: input.name,
      deliveryAddress: input.address,
      deliveryZip: input.zip,
      deliveryCity: input.city,
    },
    localeParams(),
    token
  );

  const res = await dwPost<DwOrder>(
    `/dwapi/ecommerce/carts/${secret}/createOrder`,
    {},
    localeParams(),
    token
  );
  if (!res.ok || !res.body?.id) {
    return { error: "Order could not be placed. Please try again." };
  }
  // The placed cart is consumed; drop the cart cookie so a fresh cart starts.
  (await cookies()).delete("cartId");
  return { id: res.body.id, secret: res.body.secret || secret };
}

// ---------------------------------------------------------------------------
// Revalidation — DW has no Shopify webhook topics. Time-based `cacheLife`
// (set per provider fn above) drives freshness; this endpoint is a manual
// trigger that revalidates the content tags on demand (ADR-000 §5 fallback).
// ---------------------------------------------------------------------------

export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.DW_REVALIDATION_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ status: 401 });
  }
  revalidateTag(TAGS.collections, "seconds");
  revalidateTag(TAGS.products, "seconds");
  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
