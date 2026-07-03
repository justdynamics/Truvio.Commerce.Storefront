import { impersonateAction, stopImpersonationAction } from "components/auth/actions";
import Footer from "components/layout/footer";
import Price from "components/price";
import { getAddresses, getOrders } from "lib/dynamicweb";
import { getImpersonatees, getSession } from "lib/dynamicweb/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "My account", description: "B2B customer center." };

export default async function AccountPage(props: {
  searchParams?: Promise<{ [k: string]: string | undefined }>;
}) {
  const session = await getSession();
  if (!session.isAuthenticated) redirect("/login");

  const sp = (await props.searchParams) || {};
  const [orders, addresses, impersonatees] = await Promise.all([
    getOrders(),
    getAddresses(),
    session.actingAs ? Promise.resolve([]) : getImpersonatees(),
  ]);

  const u = session.user;

  return (
    <>
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-medium">My account</h1>
        </div>

        {sp.reordered ? (
          <p className="mb-4 rounded-md bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-200">
            Items from your order were added to the cart.
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile */}
          <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-3 text-lg font-medium">Profile</h2>
            <dl className="space-y-1 text-sm">
              <Row k="Name" v={u?.name} />
              <Row k="Username" v={u?.userName} />
              <Row k="Email" v={u?.email} />
              <Row k="Customer #" v={u?.customerNumber} />
            </dl>
          </section>

          {/* Addresses */}
          <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-3 text-lg font-medium">Addresses</h2>
            {addresses.length ? (
              <ul className="space-y-3 text-sm">
                {addresses.map((a) => (
                  <li key={a.id} className="rounded border border-neutral-100 p-2 dark:border-neutral-800">
                    <div className="font-medium">{a.name || "Address"}</div>
                    <div>{a.address}</div>
                    <div>
                      {a.zip} {a.city} {a.country}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">
                No saved addresses. Primary profile address:
                <br />
                {u?.address}
                <br />
                {u?.zip} {u?.city}
              </p>
            )}
          </section>

          {/* CSR impersonation */}
          <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-3 text-lg font-medium">CSR tools</h2>
            {session.actingAs ? (
              <form action={stopImpersonationAction}>
                <p className="mb-3 text-sm">
                  Acting as <strong>{session.actingAs.name}</strong> (
                  {session.actingAs.customerNumber}).
                </p>
                <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
                  Stop impersonating
                </button>
              </form>
            ) : impersonatees.length ? (
              <form action={impersonateAction} className="space-y-3">
                <p className="text-sm text-neutral-500">
                  Sign in on behalf of a managed account:
                </p>
                <select
                  name="userId"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                  {impersonatees.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.customerNumber})
                    </option>
                  ))}
                </select>
                <button className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white">
                  Impersonate
                </button>
              </form>
            ) : (
              <p className="text-sm text-neutral-500">
                No managed accounts. (This is a buyer account, not a CSR.)
              </p>
            )}
          </section>
        </div>

        {/* Order history */}
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-medium">Order history</h2>
          {orders.length ? (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Lines</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="px-4 py-2 font-medium">
                        <Link className="underline" href={`/account/orders/${o.secret}`}>
                          {o.id}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{o.createdAt?.slice(0, 10)}</td>
                      <td className="px-4 py-2">{o.stateName}</td>
                      <td className="px-4 py-2">{o.lineCount}</td>
                      <td className="px-4 py-2">
                        <Price amount={o.total.amount} currencyCode={o.total.currencyCode} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link className="text-blue-600 underline" href={`/account/orders/${o.secret}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No orders yet.</p>
          )}
        </section>
      </div>
      <Footer />
    </>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right font-medium">{v || "—"}</dd>
    </div>
  );
}
