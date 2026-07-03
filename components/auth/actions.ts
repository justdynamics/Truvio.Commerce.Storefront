"use server";

import {
  impersonate,
  login,
  logout,
  stopImpersonation,
} from "lib/dynamicweb/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function loginAction(
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) return "Enter a username and password.";
  const res = await login(username, password);
  if (!res.ok) return res.error || "Sign-in failed.";
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  await logout();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function impersonateAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  if (userId) await impersonate(userId);
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function stopImpersonationAction(): Promise<void> {
  await stopImpersonation();
  revalidatePath("/", "layout");
  redirect("/account");
}
