"use server";

import { placeOrder } from "lib/dynamicweb";
import { TAGS } from "lib/constants";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

export async function placeOrderAction(
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const res = await placeOrder({
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    zip: String(formData.get("zip") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    country: String(formData.get("country") || "").trim() || undefined,
  });
  if ("error" in res) return res.error;
  updateTag(TAGS.cart);
  redirect(`/checkout/confirmation/${res.secret}?order=${res.id}`);
}
