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
  DW_LANGUAGE_ID,
  DW_MEDIA_BASE,
  DW_QUERY_NAME,
  DW_REPOSITORY_NAME,
  dwDelete,
  dwGet,
  dwPatch,
  dwPost,
  localeParams,
} from "./dwapi";
import {
  Cart,
  CartItem,
  Collection,
  Image,
  Menu,
  Money,
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
  groups: DwVariantNode[]
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

  // `groups` is the top-level list of first-dimension options; each carries the
  // first group's name on `variantInfoGroupName`.
  const topGroupName = groups[0]?.variantInfoGroupName || "";
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

const flattenNav = (nodes: DwNavNode[]): Menu[] =>
  (nodes || [])
    .filter((n) => n.showInMenu !== false && (n.link || n.friendlyUrl))
    .map((n) => ({
      title: n.name || "",
      path: n.friendlyUrl || n.link || "/",
    }));

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
    if (groups.length) {
      const { options, variants } = reshapeVariantTree(
        dw.id,
        base.availableForSale,
        dw.price,
        groups
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
  return flattenNav(res.body.nodes);
}

export async function getPage(handle: string): Promise<Page> {
  const now = new Date().toISOString();
  // Content pages resolve by URL; the headless skeleton exposes a limited tree.
  const res = await dwGet<{
    id?: number;
    name?: string;
    title?: string;
    description?: string;
  }>("/dwapi/content/pages/url", {
    ...localeParams(),
    url: `/${handle}`,
  });
  const b = res.ok ? res.body : undefined;
  return {
    id: String(b?.id ?? handle),
    title: b?.title || b?.name || handle,
    handle,
    body: b?.description || "",
    bodySummary: b?.description || "",
    seo: { title: b?.title || handle, description: b?.description || "" },
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
  const res = await dwGet<DwCart>(
    `/dwapi/ecommerce/carts/${secret}`,
    localeParams()
  );
  if (!res.ok || !res.body?.secret) return undefined;
  return reshapeCart(res.body);
}

export async function createCart(): Promise<Cart> {
  const res = await dwPost<DwCart>(
    "/dwapi/ecommerce/carts/create",
    {},
    localeParams()
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
      localeParams()
    );
  }
  return (await fetchCart(secret))!;
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) throw new Error("No cart");

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
      localeParams()
    );
  }
  return (await fetchCart(secret))!;
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const secret = (await cookies()).get("cartId")?.value;
  if (!secret) throw new Error("No cart");

  for (const id of lineIds) {
    await dwDelete(
      `/dwapi/ecommerce/carts/${secret}/items/${id}`,
      localeParams()
    );
  }
  return (await fetchCart(secret))!;
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
