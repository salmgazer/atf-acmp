"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Bell,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Building2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/stores";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useState } from "react";
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

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/org/dashboard" },
  { icon: FileText, label: "My Briefs", href: "/org/briefs" },
  { icon: Users, label: "Teams", href: "/org/teams" },
  { icon: Building2, label: "Profile", href: "/org/profile" },
];

interface OrganizationLayoutProps {
  children: React.ReactNode;
}

export function OrganizationLayout({ children }: OrganizationLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { sidebarCollapsed, toggleSidebarCollapse } = useUIStore();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    // Clear all cached queries to prevent stale data on next login
    queryClient.clear();
    logout();
    router.push("/org/login");
  };

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
            <Link href="/org/dashboard" className="flex items-center gap-3">
              <Image
                src="/logos/image_only/Brand-Mark_Red.png"
                alt="ATF Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-foreground">Partner</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/org/dashboard" className="mx-auto">
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
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 px-4 py-3 text-[15px] font-medium transition-all duration-200 rounded-lg",
                  isActive
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-all",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
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
            {/* Notifications */}
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

            {/* User menu dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "O"}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-foreground">
                      {user?.firstName || "Organization"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Partner Portal
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 border-b border-border/50">
                  <p className="font-semibold text-sm">{user?.firstName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/org/profile" className="flex items-center gap-2 cursor-pointer">
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
