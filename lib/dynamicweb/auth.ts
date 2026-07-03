// Frontend user session for the DynamicWeb provider.
//
// DW10's user-scoped Delivery-API surface (orders, addresses, per-user pricing,
// CSR impersonation) authenticates with a Bearer JWT minted from frontend user
// credentials at `POST /dwapi/users/authenticate` ({username,password,shopId}).
// The JWT is stored in an httpOnly cookie; every user-scoped provider call threads
// it so server-side pricing/permissions apply. Anonymous catalog reads never carry it.
//
// Impersonation (B2B CSR): a CSR mints a SECOND, impersonatee-scoped token via
// `GET /dwapi/users/impersonate` and we stash it in a separate cookie. While it is
// present it is the EFFECTIVE token (all user-scoped calls act as the buyer); the
// base CSR token is retained so we can un-impersonate.

// Server-only by construction: every function here reads/writes cookies via
// next/headers, which throws outside a server context.
import { cookies } from "next/headers";
import { dwGet, dwPost, DW_SHOP_ID } from "./dwapi";

const TOKEN_COOKIE = "dwToken";
const USER_COOKIE = "dwUser";
const ACTING_TOKEN_COOKIE = "dwActingToken";
const ACTING_USER_COOKIE = "dwActingUser";

export type DwUser = {
  id: number;
  userName: string;
  name: string;
  email: string;
  customerNumber: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  address?: string;
  city?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
};

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false, // self-signed dev host over https://localhost; not for production
  path: "/",
};

// --- token minting -------------------------------------------------------

/** Authenticate frontend credentials → JWT (or null). */
export async function authenticate(
  username: string,
  password: string
): Promise<string | null> {
  const res = await dwPost<{ token?: string }>(
    "/dwapi/users/authenticate",
    { username, password, shopId: DW_SHOP_ID }
  );
  if (!res.ok || !res.body?.token) return null;
  return res.body.token;
}

/** GET /dwapi/users/info reshaped to DwUser (Bearer required). */
export async function getUserInfoByToken(
  token: string
): Promise<DwUser | null> {
  const res = await dwGet<Record<string, unknown>>(
    "/dwapi/users/info",
    undefined,
    token
  );
  if (!res.ok || !res.body) return null;
  const b = res.body as Record<string, string | number>;
  return {
    id: Number(b.id) || 0,
    userName: String(b.userName ?? ""),
    name: String(b.name ?? ""),
    email: String(b.email ?? ""),
    customerNumber: String(b.customerNumber ?? ""),
    firstName: String(b.firstName ?? ""),
    lastName: String(b.lastName ?? ""),
    company: String(b.company ?? ""),
    address: String(b.address ?? ""),
    city: String(b.city ?? ""),
    zip: String(b.zip ?? ""),
    country: String(b.country ?? ""),
    countryCode: String(b.countryCode ?? ""),
  };
}

// --- session cookie plumbing --------------------------------------------

/** Sign in: mint a token, load the profile, persist the session. */
export async function login(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await authenticate(username, password);
  if (!token) return { ok: false, error: "Invalid username or password." };
  const user = await getUserInfoByToken(token);
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, cookieOpts);
  if (user) jar.set(USER_COOKIE, JSON.stringify(user), cookieOpts);
  return { ok: true };
}

/** Sign out: drop base + impersonation session. */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(USER_COOKIE);
  jar.delete(ACTING_TOKEN_COOKIE);
  jar.delete(ACTING_USER_COOKIE);
}

/** The base (signed-in) token — the CSR's own token when impersonating. */
export async function getBaseToken(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

/** The EFFECTIVE token used for all user-scoped calls (impersonatee if acting). */
export async function getEffectiveToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACTING_TOKEN_COOKIE)?.value ?? jar.get(TOKEN_COOKIE)?.value;
}

/** The signed-in base user (the CSR when impersonating), from the session cookie. */
export async function getBaseUser(): Promise<DwUser | null> {
  const raw = (await cookies()).get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DwUser;
  } catch {
    return null;
  }
}

/** The impersonatee being acted as, or null when not impersonating. */
export async function getActingAs(): Promise<DwUser | null> {
  const raw = (await cookies()).get(ACTING_USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DwUser;
  } catch {
    return null;
  }
}

export type Session = {
  user: DwUser | null; // effective identity (impersonatee if acting, else base)
  baseUser: DwUser | null; // the signed-in account (CSR when impersonating)
  actingAs: DwUser | null; // set only while impersonating
  isAuthenticated: boolean;
};

/** Resolve the current session for server components. */
export async function getSession(): Promise<Session> {
  const token = await getBaseToken();
  const baseUser = await getBaseUser();
  const actingAs = await getActingAs();
  return {
    user: actingAs ?? baseUser,
    baseUser,
    actingAs,
    isAuthenticated: Boolean(token),
  };
}

// --- CSR impersonation ---------------------------------------------------

/** Users the signed-in CSR may impersonate (GET /dwapi/users/impersonatees). */
export async function getImpersonatees(): Promise<DwUser[]> {
  const token = await getBaseToken();
  if (!token) return [];
  const res = await dwGet<Array<Record<string, string | number>>>(
    "/dwapi/users/impersonatees",
    undefined,
    token
  );
  if (!res.ok || !Array.isArray(res.body)) return [];
  return res.body.map((b) => ({
    id: Number(b.id) || 0,
    userName: String(b.userName ?? ""),
    name: String(b.name ?? ""),
    email: String(b.email ?? ""),
    customerNumber: String(b.customerNumber ?? ""),
    company: String(b.company ?? ""),
    city: String(b.city ?? ""),
  }));
}

/**
 * Begin impersonating a user by id: mint an impersonatee-scoped token via the
 * CSR's base token and stash it as the acting session.
 */
export async function impersonate(
  userId: number
): Promise<{ ok: boolean; error?: string }> {
  const base = await getBaseToken();
  if (!base) return { ok: false, error: "Not signed in." };
  const res = await dwGet<{ token?: string }>(
    "/dwapi/users/impersonate",
    { userId: String(userId), shopId: DW_SHOP_ID },
    base
  );
  if (!res.ok || !res.body?.token) {
    return { ok: false, error: "Impersonation not permitted for this user." };
  }
  const actingUser = await getUserInfoByToken(res.body.token);
  const jar = await cookies();
  jar.set(ACTING_TOKEN_COOKIE, res.body.token, cookieOpts);
  if (actingUser) jar.set(ACTING_USER_COOKIE, JSON.stringify(actingUser), cookieOpts);
  return { ok: true };
}

/** Stop impersonating; the CSR's base session remains signed in. */
export async function stopImpersonation(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACTING_TOKEN_COOKIE);
  jar.delete(ACTING_USER_COOKIE);
}
