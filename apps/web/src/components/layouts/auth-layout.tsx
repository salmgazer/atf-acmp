"use client";

import Image from "next/image";
import { type ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  portal: "staff" | "organization" | "participant" | "mentor";
}

const portalImages: Record<string, string> = {
  staff: "/images/auth/staff-login.jpg",
  organization: "/images/auth/org-login.jpg",
  participant: "/images/auth/participant-login.jpg",
  mentor: "/images/auth/mentor-login.jpg",
};

const portalColors: Record<string, string> = {
  staff: "from-gray-900 to-gray-800",
  organization: "from-blue-900 to-blue-800",
  participant: "from-primary/90 to-primary",
  mentor: "from-green-900 to-green-800",
};

export function AuthLayout({ children, title, subtitle, portal }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left side - Image (hidden on mobile) */}
      <div
        className={`hidden bg-gradient-to-br ${portalColors[portal]} lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12`}
      >
        <div className="relative aspect-square w-full max-w-md">
          {/* Placeholder for illustration - replace with actual images */}
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-card/10 backdrop-blur-sm">
            <div className="text-center text-white">
              <div className="mb-4">
                <Image
                  src="/logos/full/Bright-color-logo.png"
                  alt="ATF Logo"
                  width={240}
                  height={72}
                  className="mx-auto object-contain"
                />
              </div>
              <p className="mt-4 text-white/80">
                Lead the AI Revolution in Africa
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 max-w-md text-center text-white">
          <p className="text-lg font-medium">
            Join thousands of innovators building solutions that solve Africa&apos;s toughest
            problems.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <Image
              src="/logos/full/Full-color-logo.png"
              alt="ATF Logo"
              width={160}
              height={48}
              className="object-contain"
            />
          </div>

          {/* Title */}
          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/* Form content */}
          {children}
        </div>
      </div>
    </div>
  );
}
