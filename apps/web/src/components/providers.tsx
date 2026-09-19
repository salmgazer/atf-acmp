"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ChatProvider } from "@/lib/contexts/chat-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PushNotificationManager } from "@/components/push-notification-manager";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds - data considered fresh for this duration
            gcTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.statusCode >= 400 && error?.statusCode < 500) {
                return false;
              }
              return failureCount < 1;
            },
            refetchOnWindowFocus: true, // Refetch when user returns to tab
            refetchOnReconnect: true, // Refetch when network reconnects
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <ChatProvider>
            <PushNotificationManager />
            {children}
          </ChatProvider>
        </TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
