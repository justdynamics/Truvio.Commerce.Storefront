"use server";

import { reorder } from "lib/dynamicweb";
import { TAGS } from "lib/constants";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

export async function reorderAction(formData: FormData): Promise<void> {
  const secret = String(formData.get("secret") || "");
  if (secret) {
    await reorder(secret);
    updateTag(TAGS.cart);
  }
  redirect("/account?reordered=1");
}
