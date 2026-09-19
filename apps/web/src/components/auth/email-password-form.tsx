"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { signInWithEmail } from "@/lib/auth";
import { useAuthStore, type Portal, getDashboardPath } from "@/lib/stores/auth-store";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface EmailPasswordFormProps {
  portal: Portal;
  onForgotPassword?: () => void;
}

export function EmailPasswordForm({ portal, onForgotPassword }: EmailPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cohortBlocked, setCohortBlocked] = useState(false);

  const returnTo = searchParams.get("returnTo");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setCohortBlocked(false);
    try {
      const { user, token } = await signInWithEmail(data.email, data.password, portal);
      login(user, token, portal);
      toast.success("Welcome back!");
      
      // Redirect to return URL or dashboard
      const redirectTo = returnTo || getDashboardPath(portal);
      router.push(redirectTo);
    } catch (error: any) {
      console.error("Login error:", error);
      
      const message = error.response?.data?.message || error.message || "Login failed. Please try again.";
      
      // Check if this is a cohort access error
      if (message.includes("COHORT_NOT_ACCESSIBLE")) {
        setCohortBlocked(true);
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show cohort blocked message
  if (cohortBlocked) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive" className="border-orange-200 bg-orange-50 text-orange-900">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-900 font-semibold">Cohort No Longer Active</AlertTitle>
          <AlertDescription className="text-orange-800 mt-2">
            <p>Your cohort has ended and is no longer accessible.</p>
            <p className="mt-2">
              If you need access to your data or have any questions, please contact our support team.
            </p>
          </AlertDescription>
        </Alert>
        
        <div className="text-center space-y-4">
          <a
            href="mailto:support@africantechforum.org"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Contact Support
          </a>
          <div>
            <button
              type="button"
              onClick={() => setCohortBlocked(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Try a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="pl-10"
            {...register("email")}
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            className="pl-10 pr-10"
            {...register("password")}
            disabled={isLoading}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
