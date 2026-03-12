import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Supremacy Quick",
  description: "Voice assistant & quick notes for Supremacy BJJ staff",
  manifest: "/manifest-quick.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quick",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function StaffQuickLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/quick");
  }

  if (!hasRole(session.role, "manager")) {
    redirect("/my-dashboard");
  }

  return <>{children}</>;
}
