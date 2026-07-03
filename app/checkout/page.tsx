import { CheckoutForm } from "components/checkout/checkout-form";
import Footer from "components/layout/footer";
import Price from "components/price";
import { getCart } from "lib/dynamicweb";
import { getSession } from "lib/dynamicweb/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Checkout", description: "Place your order." };

export default async function CheckoutPage() {
  const session = await getSession();
  if (!session.isAuthenticated) redirect("/login?next=/checkout");

  const cart = await getCart();
  const u = session.user;

  if (!cart || cart.lines.length === 0) {
    return (
      <>
        <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-12">
          <h1 className="mb-4 text-3xl font-medium">Checkout</h1>
          <p className="text-neutral-500">
            Your cart is empty.{" "}
            <Link href="/search" className="text-blue-600 underline">
              Browse products
            </Link>
            .
          </p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
        <h1 className="mb-6 text-3xl font-medium">Checkout</h1>
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-4 text-lg font-medium">Shipping details</h2>
            <CheckoutForm
              defaults={{
                name: u?.name || "",
                email: u?.email || "",
                address: u?.address || "",
                zip: u?.zip || "",
                city: u?.city || "",
                country: u?.countryCode || "",
              }}
            />
          </section>

          <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-4 text-lg font-medium">Order summary</h2>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 py-3 text-sm">
                  <span>
                    {l.merchandise.title || l.merchandise.product.title} × {l.quantity}
                  </span>
                  <Price
                    amount={l.cost.totalAmount.amount}
                    currencyCode={l.cost.totalAmount.currencyCode}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 font-medium dark:border-neutral-700">
              <span>Total</span>
              <Price
                amount={cart.cost.totalAmount.amount}
                currencyCode={cart.cost.totalAmount.currencyCode}
              />
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
}
