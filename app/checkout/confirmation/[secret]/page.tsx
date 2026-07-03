import Footer from "components/layout/footer";
import Price from "components/price";
import { getOrder } from "lib/dynamicweb";
import { getSession } from "lib/dynamicweb/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Order confirmed", description: "Thank you." };

export default async function ConfirmationPage(props: {
  params: Promise<{ secret: string }>;
  searchParams?: Promise<{ order?: string }>;
}) {
  const session = await getSession();
  if (!session.isAuthenticated) redirect("/login");

  const { secret } = await props.params;
  const sp = (await props.searchParams) || {};
  const order = await getOrder(secret);
  const orderId = order?.id || sp.order || "";

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-4 text-5xl">✓</div>
        <h1 className="mb-2 text-3xl font-medium">Thank you — order placed</h1>
        <p className="mb-8 text-neutral-500">
          Your order <strong>{orderId}</strong> has been created in DynamicWeb.
        </p>

        {order ? (
          <div className="mx-auto max-w-md rounded-lg border border-neutral-200 p-6 text-left dark:border-neutral-800">
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-neutral-500">Order</span>
              <span className="font-medium">{order.id}</span>
            </div>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-neutral-500">Status</span>
              <span className="font-medium">{order.stateName}</span>
            </div>
            <ul className="mb-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              {order.lines.map((l) => (
                <li key={l.id} className="flex justify-between py-2">
                  <span>
                    {l.productName} × {l.quantity}
                  </span>
                  <Price amount={l.totalPrice.amount} currencyCode={l.totalPrice.currencyCode} />
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-neutral-200 pt-3 font-medium dark:border-neutral-700">
              <span>Total</span>
              <Price amount={order.total.amount} currencyCode={order.total.currencyCode} />
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex justify-center gap-4">
          <Link href="/account" className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white">
            View my orders
          </Link>
          <Link href="/search" className="rounded-full border border-neutral-300 px-5 py-2 text-sm dark:border-neutral-700">
            Continue shopping
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
