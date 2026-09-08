"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginLayout } from "@/components/auth/login-layout";
import { EmailPasswordForm } from "@/components/auth/email-password-form";
import { GuestRoute } from "@/components/auth/protected-route";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";

function StaffLoginContent() {
  const router = useRouter();
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await apiClient.get("/setup/status");
        if (!response.data.isSetupComplete) {
          // No admin exists, redirect to setup
          router.replace("/portal/setup");
          return;
        }
      } catch (err) {
        console.error("Failed to check setup status:", err);
      } finally {
        setIsCheckingSetup(false);
      }
    };

    checkSetupStatus();
  }, [router]);

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GuestRoute portal="staff">
      <LoginLayout
        title="Staff Portal Login"
        subtitle="Sign in to manage programs, cohorts, and participants"
        portalName="Staff Portal"
        imageSide="left"
      >
        <EmailPasswordForm
          portal="staff"
          onForgotPassword={() => {
            // TODO: Implement forgot password flow
          }}
        />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Need help? Contact your administrator</p>
        </div>
      </LoginLayout>
    </GuestRoute>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <StaffLoginContent />
    </Suspense>
  );
}
