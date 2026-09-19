"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LoginLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  portalName: string;
  portalType?: "participant" | "organization" | "mentor" | "staff";
  imageSide?: "left" | "right";
  className?: string;
}

function BrandSection({ portalName, portalType }: { portalName: string; portalType?: string }) {
  const imageMap: Record<string, string> = {
    participant: "/login/participant.png",
    organization: "/login/organization.png",
    mentor: "/login/mentor.png",
    staff: "/login/staff.png",
  };

  const portalImage = portalType ? imageMap[portalType] : null;

  return (
    <div className="relative z-10 flex flex-col h-full w-full">
      {/* Logo at top */}
      <div className="p-8 xl:p-12">
        <Image
          src="/logos/full/Bright-color-logo.png"
          alt="ATF Logo"
          width={180}
          height={54}
          className="object-contain"
        />
      </div>
      
      {/* Image with graphic overlays */}
      {portalImage && (
        <div className="flex-1 relative px-8 xl:px-12 py-6">
          <div className="relative w-full h-full rounded-2xl overflow-hidden">
            {/* Main image */}
            <Image
              src={portalImage}
              alt={`${portalName} illustration`}
              fill
              className="object-cover"
              priority
            />
            
            {/* Graphic overlays on the image */}
            {/* Bottom-left corner rectangle */}
            <div className="absolute bottom-0 left-0 w-1/2 aspect-[5/4] bg-primary rounded-tr-2xl" />
            
            {/* Top-right corner accent line */}
            <div className="absolute top-6 right-6 w-16 h-1 bg-white/70 rounded-full" />
            <div className="absolute top-10 right-6 w-10 h-1 bg-white/50 rounded-full" />
            
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-transparent" />
          </div>
        </div>
      )}
      
      {/* Text content with clear separation from footer */}
      <div className="px-8 xl:px-12 pt-8 pb-4 text-white">
        <p className="text-xl font-semibold">{portalName}</p>
        <p className="text-white/70 mt-2 max-w-sm text-sm leading-relaxed">
          Empowering innovation through cohort-based AI challenges. Connect, create, and compete.
        </p>
      </div>

      {/* Footer - visually separated */}
      <div className="px-8 xl:px-12 pb-8 xl:pb-10 pt-4">
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} African Technology Forum. All rights reserved.
          </p>
        </div>
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
  portalType,
  imageSide = "left",
  className,
}: LoginLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Image Section - Hidden on mobile */}
      {imageSide === "left" && (
        <div className="hidden lg:flex lg:w-1/2 relative bg-primary">
          <BrandSection portalName={portalName} portalType={portalType} />
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
        <div className="hidden lg:flex lg:w-1/2 relative bg-primary">
          <BrandSection portalName={portalName} portalType={portalType} />
        </div>
      )}
    </div>
  );
}
