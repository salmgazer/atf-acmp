"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { useAuthStore, type Portal, getDashboardPath } from "@/lib/stores/auth-store";
import { toast } from "sonner";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const codeSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;

interface MagicLinkFormProps {
  portal: Portal;
}

export function MagicLinkForm({ portal }: MagicLinkFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const returnTo = searchParams.get("returnTo");

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const handleRequestCode = async (data: EmailForm) => {
    setIsLoading(true);
    try {
      await api.post("/auth/magic-link", {
        email: data.email,
        portal,
      });
      setEmail(data.email);
      setStep("code");
      toast.success("If this email is registered, you'll receive a verification code");
    } catch (error: any) {
      console.error("Magic link error:", error);
      toast.error(error.message || "Failed to send code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (data: CodeForm) => {
    setIsLoading(true);
    try {
      const response = await api.post<{ user: any; accessToken: string }>("/auth/verify-code", {
        email,
        code: data.code,
      });
      
      login(response.user, response.accessToken, portal);
      toast.success("Welcome!");
      
      const redirectTo = returnTo || getDashboardPath(portal);
      router.push(redirectTo);
    } catch (error: any) {
      console.error("Verify code error:", error);
      toast.error(error.message || "Invalid or expired code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    codeForm.reset();
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await api.post("/auth/magic-link", {
        email,
        portal,
      });
      toast.success("If this email is registered, a new code has been sent");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "code") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>

        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to
          </p>
          <p className="font-medium">{email}</p>
        </div>

        <form onSubmit={codeForm.handleSubmit(handleVerifyCode)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] font-mono"
              {...codeForm.register("code")}
              disabled={isLoading}
              autoComplete="one-time-code"
            />
            {codeForm.formState.errors.code && (
              <p className="text-sm text-destructive">
                {codeForm.formState.errors.code.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={isLoading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Resend
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={emailForm.handleSubmit(handleRequestCode)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="pl-10"
            {...emailForm.register("email")}
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
        {emailForm.formState.errors.email && (
          <p className="text-sm text-destructive">
            {emailForm.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending code...
          </>
        ) : (
          "Continue with Email"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        We'll send you a 6-digit code to verify your email
      </p>
    </form>
  );
}
