"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoginLayout } from "@/components/auth/login-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { Loader2, ArrowLeft, CheckCircle, Eye, EyeOff, AlertCircle } from "lucide-react";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: data.password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      const message = err.message || "Failed to reset password. The link may have expired.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <LoginLayout
        title="Invalid link"
        subtitle="This password reset link is invalid"
        portalName="Staff Portal"
        portalType="staff"
        imageSide="left"
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            The password reset link is missing or invalid. Please request a new one.
          </p>
          <Button className="w-full" asChild>
            <Link href="/staff/forgot-password">
              Request new reset link
            </Link>
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
        </div>
      </LoginLayout>
    );
  }

  if (isSuccess) {
    return (
      <LoginLayout
        title="Password reset!"
        subtitle="Your password has been successfully reset"
        portalName="Staff Portal"
        portalType="staff"
        imageSide="left"
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            You can now log in with your new password.
          </p>
          <Button className="w-full" asChild>
            <Link href="/staff/login">
              Go to login
            </Link>
          </Button>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout
      title="Reset your password"
      subtitle="Enter your new password below"
      portalName="Staff Portal"
      portalType="staff"
      imageSide="left"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("password")}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("confirmPassword")}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reset password
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
