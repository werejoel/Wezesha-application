import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Leaf,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "@/api";
import { useUser } from "@/hooks/use-user";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Partners", url: "/partners", icon: Building2 },
  { title: "Users", url: "/users", icon: Users },
  { title: "Youth", url: "/youth", icon: Users },
  { title: "Sessions", url: "/sessions", icon: CalendarCheck },
  { title: "Case Management", url: "/cases", icon: FolderOpen },
  { title: "Outcomes", url: "/outcomes", icon: TrendingUp },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const roleSidebarItems: Record<string, typeof mainItems> = {
  admin: mainItems,
  program_manager: mainItems,
  ybf: [
    mainItems[0],
    mainItems[1],
    mainItems[3],
    mainItems[5],
  ],
  instructor: [
    mainItems[0],
    mainItems[3],
  ],
  enumerator: [
    mainItems[0],
    mainItems[3],
    mainItems[4],
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();

  const handleLogout = () => {
    logout();
    refreshUser();
    navigate('/login');
  };

  const menuItems = user ? roleSidebarItems[user.role] ?? roleSidebarItems.enumerator : [mainItems[0]];

  return (
    <Sidebar collapsible="icon">

      {/* ── Header ── */}
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary shadow-sm">
              <Leaf className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
            </div>
            {/* Live dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-sidebar" />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-sidebar-foreground font-heading leading-tight tracking-tight">
                Wezesha Impact
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 leading-tight mt-0.5">
                Data & Case Management
              </span>
            </div>
          )}
        </div>

        {/* User pill — visible when expanded */}
        {!collapsed && user && (
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/40">
            <div className="w-5 h-5 rounded-full bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-sidebar-primary uppercase">
                {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-sidebar-foreground truncate leading-none">
                {user.name}
              </p>
              <p className="text-[9px] text-sidebar-foreground/50 leading-none mt-0.5 truncate">
                {user.role ?? 'Member'}
              </p>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="flex flex-col justify-between h-full py-2">

        {/* ── Main Nav ── */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-1">
              Modules
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-1.5">
              {menuItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150",
                          "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                          isActive && "bg-sidebar-accent text-sidebar-primary font-medium shadow-sm"
                        )}
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sidebar-primary" />
                        )}

                        <item.icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                          )}
                        />

                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.title}</span>
                            {isActive && (
                              <ChevronRight className="h-3 w-3 text-sidebar-primary/60 flex-shrink-0" />
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Footer / Logout ── */}
        <SidebarGroup className="mt-auto pb-2">
          {!collapsed && (
            <div className="mx-3 mb-2 h-px bg-sidebar-border/40" />
          )}
          <SidebarGroupContent>
            <SidebarMenu className="px-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm w-full transition-all duration-150",
                    "text-sidebar-foreground/50 hover:text-red-500 hover:bg-red-500/10"
                  )}
                >
                  <LogOut className="h-4 w-4 flex-shrink-0 transition-colors group-hover:text-red-500" />
                  {!collapsed && <span>Logout</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}