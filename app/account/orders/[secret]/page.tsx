import { reorderAction } from "app/account/actions";
import Footer from "components/layout/footer";
import Price from "components/price";
import { getOrder } from "lib/dynamicweb";
import { getSession } from "lib/dynamicweb/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Order", description: "Order detail." };

export default async function OrderDetailPage(props: {
  params: Promise<{ secret: string }>;
}) {
  const session = await getSession();
  if (!session.isAuthenticated) redirect("/login");

  const { secret } = await props.params;
  const order = await getOrder(secret);
  if (!order) return notFound();

  return (
    <>
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
        <Link href="/account" className="text-sm text-blue-600 underline">
          ← Back to account
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium">Order {order.id}</h1>
            <p className="text-sm text-neutral-500">
              {order.createdAt?.slice(0, 10)} · {order.stateName} · {order.customerName}
            </p>
          </div>
          <form action={reorderAction}>
            <input type="hidden" name="secret" value={order.secret} />
            <button className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90">
              Reorder
            </button>
          </form>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">
                    <Link className="underline" href={`/product/${l.productNumber}`}>
                      {l.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{l.productNumber}</td>
                  <td className="px-4 py-2">{l.quantity}</td>
                  <td className="px-4 py-2">
                    <Price amount={l.unitPrice.amount} currencyCode={l.unitPrice.currencyCode} />
                  </td>
                  <td className="px-4 py-2">
                    <Price amount={l.totalPrice.amount} currencyCode={l.totalPrice.currencyCode} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 font-medium dark:border-neutral-700">
                <td className="px-4 py-2" colSpan={4}>
                  Order total
                </td>
                <td className="px-4 py-2">
                  <Price amount={order.total.amount} currencyCode={order.total.currencyCode} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <Footer />
    </>
  );
}
