"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Loader2, Users, Briefcase, GraduationCap, ArrowRight } from "lucide-react";

// Portal dashboard paths
const PORTAL_DASHBOARDS = {
  staff: "/staff/dashboard",
  partner: "/partners/dashboard",
  participant: "/participant/dashboard",
  mentor: "/mentor/dashboard",
} as const;

const portals = [
  {
    name: "Participant Portal",
    description: "Join the challenge and build AI solutions",
    href: "/participant/login",
    icon: GraduationCap,
    image: "/login/participant.png",
    cta: "Join the Challenge",
  },
  {
    name: "Partner Portal",
    description: "Submit briefs and sponsor challenges",
    href: "/partners/login",
    icon: Briefcase,
    image: "/login/organization.png",
    cta: "Submit Briefs",
  },
  {
    name: "Mentor Portal",
    description: "Guide teams and share expertise",
    href: "/mentor/login",
    icon: Users,
    image: "/login/mentor.png",
    cta: "Start Mentoring",
  },
];

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
      <main className="flex h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated && portal) {
    return (
      <main className="flex h-screen flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </main>
    );
  }

  // Not authenticated - show portal selection
  return (
    <main className="min-h-screen flex flex-col lg:h-screen lg:overflow-hidden">
      {/* Hero Section */}
      <section className="relative bg-primary flex-shrink-0">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8 lg:py-12">
          <div className="text-center">
            <div className="mb-4 lg:mb-6">
              <Image
                src="/logos/full/Bright-color-logo.png"
                alt="ATF Logo"
                width={180}
                height={54}
                className="object-contain mx-auto w-[140px] lg:w-[180px]"
              />
            </div>
            
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-3 lg:mb-4 leading-tight">
              Africa&apos;s Largest AI Challenge
            </h1>
            
            <p className="text-sm md:text-lg text-white/80 max-w-xl mx-auto">
              Upskill, form a team, and build innovative solutions that solve 
              Africa&apos;s toughest problems.
            </p>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-8 lg:h-auto" preserveAspectRatio="none">
            <path d="M0 60L60 52.5C120 45 240 30 360 22.5C480 15 600 15 720 18.75C840 22.5 960 30 1080 33.75C1200 37.5 1320 37.5 1380 37.5L1440 37.5V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      {/* Portals Section */}
      <section className="flex-1 bg-background flex flex-col justify-center py-6 lg:py-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-4 lg:mb-6">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-1 lg:mb-2">
              Choose Your Portal
            </h2>
            <p className="text-xs lg:text-sm text-muted-foreground">
              Select your role to get started
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 max-w-5xl mx-auto">
            {portals.map((portal) => (
              <Link
                key={portal.name}
                href={portal.href}
                className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary hover:-translate-y-1"
              >
                {/* Image Header */}
                <div className="relative h-28 lg:h-36 overflow-hidden">
                  <Image
                    src={portal.image}
                    alt={portal.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  
                  {/* Icon badge */}
                  <div className="absolute top-3 right-3 p-2 bg-primary rounded-lg text-white shadow-lg">
                    <portal.icon className="w-5 h-5" />
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 lg:p-4">
                  <h3 className="text-base lg:text-lg font-semibold text-card-foreground mb-1 group-hover:text-primary transition-colors">
                    {portal.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2 lg:mb-3">
                    {portal.description}
                  </p>
                  <div className="flex items-center justify-between text-sm font-medium text-primary">
                    <span>{portal.cta}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t border-border py-3 lg:py-4 flex-shrink-0">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <Image
              src="/logos/full/Full-color-logo.png"
              alt="ATF Logo"
              width={100}
              height={30}
              className="object-contain w-[80px] lg:w-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} African Technology Forum. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
