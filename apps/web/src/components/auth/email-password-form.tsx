"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

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
