"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LoginLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  portalName: string;
  imageUrl?: string;
  imageSide?: "left" | "right";
  className?: string;
}

function BrandSection({ portalName }: { portalName: string }) {
  return (
    <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
      <div className="flex items-center gap-3">
        <Image
          src="/logos/full/Bright-color-logo.png"
          alt="ATF Logo"
          width={200}
          height={60}
          className="object-contain"
        />
      </div>
      <div>
        <p className="text-xl font-medium">{portalName}</p>
        <p className="text-white/70 mt-2 max-w-md">
          Empowering innovation through cohort-based AI challenges. Connect, create, and compete.
        </p>
      </div>
      <div className="text-sm text-white/60">
        © {new Date().getFullYear()} Africa's Talking Foundation. All rights reserved.
      </div>
    </div>
  );
}

/**
 * Split-screen login layout for desktop, full-width on mobile
 */
export function LoginLayout({
  children,
  title,
  subtitle,
  portalName,
  imageUrl = "/images/login-hero.jpg",
  imageSide = "left",
  className,
}: LoginLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Image Section - Hidden on mobile */}
      {imageSide === "left" && (
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/90 to-primary">
          <div className="absolute inset-0 bg-black/20" />
          <BrandSection portalName={portalName} />
        </div>
      )}

      {/* Form Section */}
      <div
        className={cn(
          "w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-16",
          className
        )}
      >
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Image
              src="/logos/full/Full-color-logo.png"
              alt="ATF Logo"
              width={180}
              height={54}
              className="mx-auto mb-2"
            />
            <p className="text-muted-foreground text-sm">{portalName}</p>
          </div>

          {/* Title */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/* Form Content */}
          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Image Section - Right side variant */}
      {imageSide === "right" && (
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/90 to-primary">
          <div className="absolute inset-0 bg-black/20" />
          <BrandSection portalName={portalName} />
        </div>
      )}
    </div>
  );
}
