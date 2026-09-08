"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Home, FileText, Users, MessageSquare, User, Bell, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationCount } from "@/lib/api/hooks/use-notifications";
import { useChatContext } from "@/lib/contexts/chat-context";
import { Button } from "@/components/ui/button";

interface ParticipantLayoutProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function ParticipantLayout({ children, noPadding }: ParticipantLayoutProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: countData } = useNotificationCount();
  const { totalUnreadCount } = useChatContext();
  
  const unreadCount = countData?.data?.unread || 0;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const navItems = [
    { icon: Home, label: "Home", href: "/app/dashboard", badge: 0 },
    { icon: FileText, label: "Briefs", href: "/app/briefs", badge: 0 },
    { icon: Users, label: "Team", href: "/app/team", badge: 0 },
    { icon: MessageSquare, label: "Chat", href: "/app/chat", badge: totalUnreadCount },
    { icon: User, label: "Profile", href: "/app/profile", badge: 0 },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/app/dashboard" className="flex items-center gap-2">
            <Image
              src="/logos/image_only/Brand-Mark_Red.png"
              alt="ATF Logo"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="font-semibold">AI Challenge</span>
          </Link>
          <div className="flex items-center gap-1">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-full"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* Notifications */}
            <Link 
              href="/app/notifications" 
              className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main content - with padding for bottom nav */}
      <main className={cn(
        "flex-1 pb-20",
        noPadding ? "overflow-hidden" : "px-4 pt-4"
      )}>{children}</main>

      {/* Bottom Navigation - Mobile First */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-inset-bottom">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
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
  );
}
