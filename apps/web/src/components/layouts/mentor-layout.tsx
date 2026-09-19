"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Users,
  MessageSquare,
  User,
  Bell,
  Sun,
  Moon,
  Monitor,
  Calendar,
  Clock,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationCount } from "@/lib/api/hooks/use-notifications";
import { useChatContext } from "@/lib/contexts/chat-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";

interface MentorLayoutProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

// Main navigation items
const mainNavItems = [
  { icon: Home, label: "Dashboard", href: "/mentor/dashboard" },
  { icon: Users, label: "Teams", href: "/mentor/teams" },
  { icon: Calendar, label: "Calendar", href: "/mentor/calendar" },
  { icon: Clock, label: "Availability", href: "/mentor/availability" },
  { icon: MessageSquare, label: "Chat", href: "/mentor/chat", hasBadge: true },
];

export function MentorLayout({ children, noPadding }: MentorLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: countData } = useNotificationCount();
  const { totalUnreadCount } = useChatContext();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = (countData as any)?.data?.unread || countData?.unread || 0;

  const handleLogout = () => {
    queryClient.clear();
    logout();
    router.push("/mentor/login");
  };

  // Mobile bottom navigation items with badges
  const mobileNavItems = mainNavItems.map((item) => ({
    ...item,
    badge: item.hasBadge ? totalUnreadCount : 0,
  }));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card border-r border-border/50 transition-transform duration-300 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
          <Link href="/mentor/dashboard" className="flex items-center gap-3">
            <Image
              src="/logos/image_only/Brand-Mark_Red.png"
              alt="ATF Logo"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-foreground">Mentor Portal</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 hover:bg-accent md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </p>
            {mainNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const showBadge = item.hasBadge && totalUnreadCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                      {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section at bottom of sidebar */}
        <div className="border-t border-border/50 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "M"}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.firstName || "Mentor"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/mentor/profile" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/mentor/notifications" className="flex items-center gap-2 cursor-pointer">
                  <Bell className="h-4 w-4" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
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
                      {theme === "light" && <span className="ml-auto text-primary">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("dark")}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Moon className="h-4 w-4" />
                      Dark
                      {theme === "dark" && <span className="ml-auto text-primary">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("system")}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Monitor className="h-4 w-4" />
                      System
                      {theme === "system" && <span className="ml-auto text-primary">✓</span>}
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
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-h-screen">
        {/* Top Header - Desktop: minimal, Mobile: full */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4 md:h-16 md:px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-accent transition-colors md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile logo */}
          <Link href="/mentor/dashboard" className="flex items-center gap-2 md:hidden">
            <Image
              src="/logos/image_only/Brand-Mark_Red.png"
              alt="ATF Logo"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="font-semibold text-sm">Mentor Portal</span>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop header actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Notifications */}
            <Link
              href="/mentor/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors"
            >
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile link */}
            <Link
              href="/mentor/profile"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                pathname.startsWith("/mentor/profile")
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              <User
                className={cn(
                  "h-[18px] w-[18px]",
                  pathname.startsWith("/mentor/profile") ? "text-primary" : "text-muted-foreground"
                )}
              />
            </Link>
          </div>

          {/* Mobile header actions */}
          <div className="flex md:hidden items-center gap-1">
            <Link
              href="/mentor/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href="/mentor/profile"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                pathname.startsWith("/mentor/profile")
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted"
              )}
            >
              <User
                className={cn(
                  "h-4 w-4",
                  pathname.startsWith("/mentor/profile") ? "text-primary" : "text-muted-foreground"
                )}
              />
            </Link>
          </div>
        </header>

        {/* Main content - with padding for mobile bottom nav */}
        <main
          className={cn(
            "flex-1 pb-20 md:pb-0",
            noPadding ? "overflow-hidden" : "px-4 pt-4 md:px-6 md:pt-6"
          )}
        >
          {/* Content wrapper with max-width for very large screens */}
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Mobile Bottom Navigation - Hidden on desktop */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-inset-bottom md:hidden">
          <div className="flex items-center justify-around py-2">
            {mobileNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className="relative">
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    {item.badge > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={cn("font-medium", isActive && "text-primary")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
