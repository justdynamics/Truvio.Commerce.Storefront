import { LoginForm } from "components/auth/login-form";
import Footer from "components/layout/footer";
import { getSession } from "lib/dynamicweb/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in",
  description: "Sign in to your B2B account.",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session.isAuthenticated) redirect("/account");

  return (
    <>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-6 text-3xl font-medium">Sign in</h1>
        <div className="rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-black">
          <LoginForm />
        </div>
      </div>
      <Footer />
    </>
  );
}
