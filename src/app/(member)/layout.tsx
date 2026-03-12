import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MemberShell } from "@/components/MemberShell";

export default async function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <MemberShell
      displayName={session.displayName}
      role={session.role}
    >
      {children}
    </MemberShell>
  );
}
