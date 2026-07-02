import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useUser } from "@/hooks/use-user";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PendingValidationGate } from "@/components/PendingValidationGate";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WI";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="mr-1" />
             {/*  <div className="hidden sm:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search youth, partners..."
                  className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground"
                />
              </div>
              */}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <div className="flex items-center gap-2 ml-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                  {initials}
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <PendingValidationGate>{children}</PendingValidationGate>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
