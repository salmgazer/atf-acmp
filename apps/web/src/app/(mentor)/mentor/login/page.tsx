"use client";

import { Suspense } from "react";
import { LoginLayout } from "@/components/auth/login-layout";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { GuestRoute } from "@/components/auth/protected-route";
import { Loader2 } from "lucide-react";

function MentorLoginContent() {
  return (
    <GuestRoute portal="mentor">
      <LoginLayout
        title="Mentor Portal"
        subtitle="Sign in to guide and support your assigned teams"
        portalName="Mentor Portal"
        portalType="mentor"
        imageSide="left"
      >
        <MagicLinkForm portal="mentor" />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Having trouble? Contact support at support@atfchallenge.org</p>
        </div>
      </LoginLayout>
    </GuestRoute>
  );
}

export default function MentorLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MentorLoginContent />
    </Suspense>
  );
}
