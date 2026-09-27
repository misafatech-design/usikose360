import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CalendarPlus,
  Compass,
  LayoutDashboard,
  LogOut,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

type Item = { title: string; url: string; icon: LucideIcon; exact?: boolean };

function NavGroup({ label, items }: { label: string; items: Item[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((it) => {
            const active = it.exact ? path === it.url : path === it.url || path.startsWith(it.url + "/");
            return (
              <SidebarMenuItem key={it.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={it.title}>
                  <Link to={it.url}>
                    <it.icon className="h-4 w-4" />
                    <span>{it.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AppSidebar() {
  const { user, isOrganizer, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const general: Item[] = [
    { title: "Browse events", url: "/events", icon: Compass, exact: true },
    { title: "My tickets", url: "/tickets", icon: Ticket },
    { title: "Admissions", url: "/admit", icon: ScanLine },
  ];
  const organizer: Item[] = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Create event", url: "/events/new", icon: CalendarPlus },
    { title: "Withdrawals", url: "/payouts", icon: Wallet },
  ];
  const admin: Item[] = [
    { title: "Overview", url: "/admin", icon: ShieldCheck, exact: true },
    { title: "Featured events", url: "/admin/events", icon: Sparkles },
    { title: "M-Pesa settings", url: "/admin/mpesa", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="px-1 py-1">
          <Logo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {isOrganizer && <NavGroup label="Organizer" items={organizer} />}
        {isAdmin && <NavGroup label="Administration" items={admin} />}
        <NavGroup label="General" items={general} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:hidden">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {(user?.email ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-xs text-sidebar-foreground/70">{user?.email}</span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={async () => {
                await signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-transparent">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur">
            <SidebarTrigger />
            <Link to="/" className="md:hidden">
              <Logo />
            </Link>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
