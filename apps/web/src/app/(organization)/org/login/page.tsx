"use client";

import { Suspense } from "react";
import { LoginLayout } from "@/components/auth/login-layout";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { GuestRoute } from "@/components/auth/protected-route";
import { Loader2 } from "lucide-react";

function OrganizationLoginContent() {
  return (
    <GuestRoute portal="organization">
      <LoginLayout
        title="Organization Portal"
        subtitle="Sign in to track your team's progress and submissions"
        portalName="Organization Portal"
        portalType="organization"
        imageSide="left"
      >
        <MagicLinkForm portal="organization" />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Having trouble? Contact support at support@atfchallenge.org</p>
        </div>
      </LoginLayout>
    </GuestRoute>
  );
}

export default function OrganizationLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OrganizationLoginContent />
    </Suspense>
  );
}
