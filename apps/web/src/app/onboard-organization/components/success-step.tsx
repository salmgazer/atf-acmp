"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

interface SuccessStepProps {
  orgName: string;
  opportunityCount: number;
  opportunityTitles: string[];
}

export function SuccessStep({ orgName, opportunityCount, opportunityTitles }: SuccessStepProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const logoSrc = isDark
    ? "/logos/full/Bright-color-logo.png"
    : "/logos/full/Full-color-logo.png";

  const briefText = opportunityCount === 1 ? "brief" : `${opportunityCount} briefs`;
  const reviewText = opportunityCount === 1 ? "it" : "each one";

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-center sm:justify-start">
            {mounted ? (
              <Image
                src={logoSrc}
                alt="Africa Technology Foundation"
                width={180}
                height={48}
                className="h-10 w-auto"
                priority
              />
            ) : (
              <div className="h-10 w-[180px]" />
            )}
          </div>
        </div>
      </header>

      {/* Success Content */}
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#17A589]/10 dark:bg-[#17A589]/20">
            <CheckCircle2 className="h-8 w-8 text-[#17A589]" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-[#1B2A4A] dark:text-white mb-4">
            Thank you for your submission!
          </h1>

          {/* Message */}
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
            We have received your {briefText}. A country lead will review {reviewText} and be in touch with next steps.
          </p>

          {/* Email Notice */}
          <div className="rounded-lg bg-[#17A589]/10 dark:bg-[#17A589]/20 p-4 mb-8 text-left border border-[#17A589]/20">
            <p className="text-sm text-[#17A589] dark:text-[#2DD4A8] font-medium mb-1">
              📧 Check your inbox
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              We've sent a welcome email to your registered email address with instructions on how to access the Organization Portal. To log in, simply enter your email and we'll send you a verification code.
            </p>
          </div>

          {/* Briefs Submitted */}
          <div className="text-left mb-6">
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">
              Briefs submitted
            </h3>
            <div className="space-y-3">
              {opportunityTitles.map((title, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-[#F7F8FA] dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700"
                >
                  <p className="font-semibold text-[#1B2A4A] dark:text-white mb-1">
                    Brief {index + 1}: {title}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Received — under review
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="rounded-lg bg-[#F7F8FA] dark:bg-slate-800 p-4 text-left border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              A country lead will review each brief and be in touch. Briefs that are selected are matched with a student team, who will build a working solution and present it at Demo Day.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Africa Technology Foundation © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
