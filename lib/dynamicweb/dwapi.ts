// Thin fetch client for the DynamicWeb 10 Delivery API (`/dwapi/**`, REST/JSON).
// All DW coupling (base URL, locale/shop context, self-signed TLS) lives here.

// Self-signed dev host only: the harness serves https://localhost with a
// self-signed cert. Node rejects it by default; opt out for the dev host.
// (Set via env in .env; also forced here so server components/build succeed.)
if (
  process.env.DW_ALLOW_SELF_SIGNED === "1" &&
  process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0"
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export const DW_API_BASE = (
  process.env.DW_API_BASE || "https://localhost:57301"
).replace(/\/$/, "");

export const DW_SHOP_ID = process.env.DW_SHOP_ID || "SHOP1";
export const DW_LANGUAGE_ID = process.env.DW_LANGUAGE_ID || "ENU";
export const DW_CURRENCY_CODE = process.env.DW_CURRENCY_CODE || "EUR";
export const DW_COUNTRY_CODE = process.env.DW_COUNTRY_CODE || "DK";
export const DW_AREA_ID = process.env.DW_AREA_ID || "5";
export const DW_REPOSITORY_NAME = process.env.DW_REPOSITORY_NAME || "Headless";
export const DW_QUERY_NAME = process.env.DW_QUERY_NAME || "Products";

// DW media (product images / files) serve from the host root under `/Files/...`.
export const DW_MEDIA_BASE = DW_API_BASE;

// Locale/shop context every Delivery-API call must carry (BASELINE locale contract).
export const localeParams = (): Record<string, string> => ({
  LanguageId: DW_LANGUAGE_ID,
  ShopId: DW_SHOP_ID,
  CurrencyCode: DW_CURRENCY_CODE,
  CountryCode: DW_COUNTRY_CODE,
});

const buildUrl = (path: string, params?: Record<string, string | undefined>) => {
  const url = new URL(
    `${DW_API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }
  return url.toString();
};

type DwFetchOpts = {
  method?: string;
  params?: Record<string, string | undefined>;
  body?: unknown;
  // Bearer JWT for user-scoped endpoints (orders, addresses, per-user pricing,
  // impersonation). Anonymous calls omit it. NEVER cache a token-bearing response
  // in the shared ("use cache") layer — user scope must stay request-private.
  token?: string;
  // Next.js caching hints passed through to fetch.
  cache?: RequestCache;
  revalidate?: number;
};

export async function dwFetch<T>(
  path: string,
  opts: DwFetchOpts = {}
): Promise<{ status: number; ok: boolean; body: T }> {
  const { method = "GET", params, body, token, cache, revalidate } = opts;
  const url = buildUrl(path, params);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit & { next?: { revalidate?: number } } = {
    method,
    headers,
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (cache) init.cache = cache;
  if (revalidate !== undefined) init.next = { revalidate };

  const res = await fetch(url, init);
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, ok: res.ok, body: parsed as T };
}

export const dwGet = <T>(
  path: string,
  params?: Record<string, string | undefined>,
  token?: string
) => dwFetch<T>(path, { method: "GET", params, token });

export const dwPost = <T>(
  path: string,
  body?: unknown,
  params?: Record<string, string | undefined>,
  token?: string
) => dwFetch<T>(path, { method: "POST", body, params, token });

export const dwPatch = <T>(
  path: string,
  body?: unknown,
  params?: Record<string, string | undefined>,
  token?: string
) => dwFetch<T>(path, { method: "PATCH", body, params, token });

export const dwDelete = <T>(
  path: string,
  params?: Record<string, string | undefined>,
  token?: string
) => dwFetch<T>(path, { method: "DELETE", params, token });
