"use client";

import { Suspense } from "react";
import { LoginLayout } from "@/components/auth/login-layout";
import { EmailPasswordForm } from "@/components/auth/email-password-form";
import { GuestRoute } from "@/components/auth/protected-route";
import { Loader2 } from "lucide-react";

function ParticipantLoginContent() {
  return (
    <GuestRoute portal="participant">
      <LoginLayout
        title="Welcome back"
        subtitle="Sign in to continue your AI challenge journey"
        portalName="Participant Portal"
        imageSide="left"
      >
        <EmailPasswordForm
          portal="participant"
          onForgotPassword={() => {
            // TODO: Implement forgot password flow
          }}
        />
        <div className="mt-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                First time here?
              </span>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Use the credentials sent to your email by your organization.
            You'll be prompted to change your password on first login.
          </p>
        </div>
      </LoginLayout>
    </GuestRoute>
  );
}

export default function ParticipantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ParticipantLoginContent />
    </Suspense>
  );
}
