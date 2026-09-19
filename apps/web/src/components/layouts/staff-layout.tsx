"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  FileText,
  Building2,
  UserCog,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Layers,
  Bell,
  GraduationCap,
  User,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  ScrollText,
  Shield,
  MessageSquare,
  ClipboardCheck,
  Bot,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useStaffCohortStore } from "@/lib/stores";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useChatContext } from "@/lib/contexts/chat-context";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const overviewItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/portal/dashboard" },
  { icon: Layers, label: "Cohorts", href: "/portal/cohorts" },
  { icon: Users, label: "Teams", href: "/portal/teams" },
  { icon: ClipboardCheck, label: "Submissions Review", href: "/portal/submissions/review" },
  { icon: Bot, label: "AI Evaluations", href: "/portal/evaluations" },
  { icon: FileText, label: "Briefs", href: "/portal/briefs" },
  { icon: MessageSquare, label: "Chat", href: "/portal/chat" },
];

const managementItems = [
  { icon: UserCog, label: "Participants", href: "/portal/participants" },
  { icon: GraduationCap, label: "Mentors", href: "/portal/mentors" },
  { icon: Building2, label: "Organizations", href: "/portal/organizations" },
  { icon: Shield, label: "Staff", href: "/portal/staff" },
];

const settingsItems = [
  { icon: ScrollText, label: "Audit Logs", href: "/portal/audit-logs" },
];

interface StaffLayoutProps {
  children: React.ReactNode;
}

export function StaffLayout({ children }: StaffLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { sidebarCollapsed, toggleSidebarCollapse } = useUIStore();
  const { user, logout } = useAuthStore();
  const { totalUnreadCount } = useChatContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Global cohort context
  const { 
    globalCohort, 
    globalCohortId,
    cohorts, 
    setCohorts, 
    setGlobalCohortById, 
    initializeGlobalCohort 
  } = useStaffCohortStore();
  
  // Fetch cohorts
  const { data: cohortsData } = useCohorts({ limit: 100 });
  
  // Update store when cohorts are fetched
  useEffect(() => {
    if (cohortsData?.data && cohortsData.data.length > 0) {
      const cohortList = cohortsData.data.map((c) => ({ id: c.id, name: c.name }));
      setCohorts(cohortList);
      initializeGlobalCohort();
    }
  }, [cohortsData, setCohorts, initializeGlobalCohort]);

  const handleLogout = () => {
    // Clear all cached queries to prevent stale data on next login
    queryClient.clear();
    logout();
    router.push("/portal/login");
  };

  const NavSection = ({
    title,
    items,
  }: {
    title: string;
    items: typeof overviewItems;
  }) => (
    <div className="space-y-1">
      {!sidebarCollapsed && (
        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const isChatItem = item.href === "/portal/chat";
        const showBadge = isChatItem && totalUnreadCount > 0;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 px-4 py-3 text-[15px] font-medium transition-all duration-200",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-all",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {showBadge && sidebarCollapsed && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                </span>
              )}
            </div>
            {!sidebarCollapsed && (
              <span className="flex-1">{item.label}</span>
            )}
            {showBadge && !sidebarCollapsed && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border/50 transition-all duration-300 lg:static",
          sidebarCollapsed ? "w-20" : "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between px-5">
          {!sidebarCollapsed && (
            <Link href="/portal/dashboard" className="flex items-center gap-3">
              <Image
                src="/logos/image_only/Brand-Mark_Red.png"
                alt="ATF Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-foreground">ACMP</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/portal/dashboard" className="mx-auto">
              <Image
                src="/logos/image_only/Brand-Mark_Red.png"
                alt="ATF Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
            </Link>
          )}
          <button
            onClick={toggleSidebarCollapse}
            className="hidden rounded-lg p-2 hover:bg-accent transition-colors lg:block"
          >
            <ChevronLeft
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-300",
                sidebarCollapsed && "rotate-180"
              )}
            />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 hover:bg-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {/* Global Cohort Selector */}
          {!sidebarCollapsed ? (
            <div className="px-1 pb-2">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cohort
              </p>
              <Select
                value={globalCohortId || ""}
                onValueChange={(value) => setGlobalCohortById(value)}
              >
                <SelectTrigger className="w-full bg-accent/50 border-border/50">
                  <SelectValue placeholder="Select cohort">
                    {globalCohort?.name || "Select cohort"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex justify-center pb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                    title={globalCohort?.name || "Select cohort"}
                  >
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-56">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Select Cohort
                  </div>
                  <DropdownMenuSeparator />
                  {cohorts.map((cohort) => (
                    <DropdownMenuItem
                      key={cohort.id}
                      onClick={() => setGlobalCohortById(cohort.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      {cohort.name}
                      {globalCohortId === cohort.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          
          <NavSection title="Overview" items={overviewItems} />
          <NavSection title="Management" items={managementItems} />
          <NavSection title="Settings" items={settingsItems} />
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 bg-background px-4 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-accent transition-colors lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Spacer to push right side content */}
          <div className="flex-1" />

          {/* Right side - notifications and user dropdown */}
          <div className="flex items-center gap-3 ml-auto md:ml-0">
            {/* Notifications - rounded square style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors">
                  <Bell className="h-[18px] w-[18px] text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="p-3 border-b border-border/50">
                  <p className="font-semibold">Notifications</p>
                </div>
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu dropdown - cleaner style like Coursue */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-foreground">
                      {user?.firstName || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user?.role?.replace("_", " ") || "Staff"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 border-b border-border/50">
                  <p className="font-semibold text-sm">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/portal/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : theme === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onClick={() => setTheme("light")}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Sun className="h-4 w-4" />
                        Light
                        {theme === "light" && <span className="ml-auto text-primary">&#10003;</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme("dark")}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Moon className="h-4 w-4" />
                        Dark
                        {theme === "dark" && <span className="ml-auto text-primary">&#10003;</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme("system")}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Monitor className="h-4 w-4" />
                        System
                        {theme === "system" && <span className="ml-auto text-primary">&#10003;</span>}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content - scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
