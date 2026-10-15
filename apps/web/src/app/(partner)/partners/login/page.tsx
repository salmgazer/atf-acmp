"use client";

import { Suspense } from "react";
import { LoginLayout } from "@/components/auth/login-layout";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { GuestRoute } from "@/components/auth/protected-route";
import { Loader2 } from "lucide-react";

function PartnerLoginContent() {
  return (
    <GuestRoute portal="partner">
      <LoginLayout
        title="Partner Portal"
        subtitle="Sign in to track your team's progress and submissions"
        portalName="Partner Portal"
        portalType="partner"
        imageSide="left"
      >
        <MagicLinkForm portal="partner" />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Having trouble? Contact support at support@atfchallenge.org</p>
        </div>
      </LoginLayout>
    </GuestRoute>
  );
}

export default function PartnerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PartnerLoginContent />
    </Suspense>
  );
}
