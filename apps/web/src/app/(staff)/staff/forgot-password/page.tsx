"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoginLayout } from "@/components/auth/login-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const email = watch("email");

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await api.post("/auth/forgot-password", {
        email: data.email,
        portal: "staff",
      });
      setIsSubmitted(true);
    } catch (err: any) {
      // Always show success to prevent email enumeration
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <LoginLayout
        title="Check your email"
        subtitle="We've sent you a password reset link"
        portalName="Staff Portal"
        portalType="staff"
        imageSide="left"
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <Mail className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 1 hour.
            </p>
          </div>
          <div className="space-y-3">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/staff/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Link>
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="text-primary hover:underline"
            >
              try again
            </button>
          </p>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link"
      portalName="Staff Portal"
      portalType="staff"
      imageSide="left"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
            disabled={isSubmitting}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
        </Button>

        <div className="text-center">
          <Link
            href="/staff/login"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="inline-block mr-1 h-3 w-3" />
            Back to login
          </Link>
        </div>
      </form>
    </LoginLayout>
  );
}
