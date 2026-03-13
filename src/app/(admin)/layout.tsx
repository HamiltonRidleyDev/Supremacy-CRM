import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { GuidedTour } from "@/components/GuidedTour";
import { FeedbackButton } from "@/components/FeedbackButton";
import { QuickStartWrapper } from "@/components/QuickStartWrapper";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Only admin and manager can access admin panel
  if (!hasRole(session.role, "manager")) {
    redirect("/my-dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-60 p-4 md:p-8 pb-20 md:pb-8">
        {children}
      </main>
      <FeedbackButton />
      <GuidedTour />
      <QuickStartWrapper />
    </div>
  );
}
