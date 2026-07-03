"use client";

import { placeOrderAction } from "app/checkout/actions";
import { useActionState } from "react";

type Defaults = {
  name: string;
  email: string;
  address: string;
  zip: string;
  city: string;
  country: string;
};

const field =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";

export function CheckoutForm({ defaults }: { defaults: Defaults }) {
  const [error, formAction, pending] = useActionState(
    placeOrderAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Name</span>
          <input name="name" required defaultValue={defaults.name} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Email</span>
          <input name="email" type="email" defaultValue={defaults.email} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          Shipping address
        </span>
        <input name="address" required defaultValue={defaults.address} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Postal code</span>
          <input name="zip" required defaultValue={defaults.zip} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">City</span>
          <input name="city" required defaultValue={defaults.city} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Country</span>
          <input name="country" defaultValue={defaults.country} className={field} />
        </label>
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Placing order…" : "Place order"}
      </button>
    </form>
  );
}
