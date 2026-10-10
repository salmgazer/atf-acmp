"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Loader2 } from "lucide-react";

// Portal dashboard paths
const PORTAL_DASHBOARDS = {
  staff: "/portal/dashboard",
  organization: "/org/dashboard",
  participant: "/app/dashboard",
  mentor: "/mentor/dashboard",
} as const;

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, portal } = useAuthStore();

  useEffect(() => {
    // Wait for auth state to hydrate
    if (isLoading) return;

    // If authenticated with a known portal, redirect to that portal's dashboard
    if (isAuthenticated && portal) {
      const dashboardPath = PORTAL_DASHBOARDS[portal];
      if (dashboardPath) {
        router.replace(dashboardPath);
      }
    }
  }, [isAuthenticated, isLoading, portal, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated && portal) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </main>
    );
  }

  // Not authenticated - show portal selection
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          ATF AI Challenge
        </h1>
        <p className="max-w-2xl text-center text-lg text-muted-foreground">
          The continent&apos;s largest hands-on Artificial Intelligence program. Upskill, form a
          team, and build solutions that solve Africa&apos;s toughest problems.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/portal/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Staff Portal
            </span>
            <span className="text-sm text-muted-foreground">Manage the platform</span>
          </Link>

          <Link
            href="/org/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Organization Portal
            </span>
            <span className="text-sm text-muted-foreground">Submit briefs</span>
          </Link>

          <Link
            href="/app/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Participant Portal
            </span>
            <span className="text-sm text-muted-foreground">Join the challenge</span>
          </Link>

          <Link
            href="/mentor/login"
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="text-lg font-semibold text-card-foreground group-hover:text-accent-foreground">
              Mentor Portal
            </span>
            <span className="text-sm text-muted-foreground">Guide teams</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
