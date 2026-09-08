"use client";

import { cn } from "@/lib/utils";
import { Award, Trophy, Star, Medal, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Certificate, CertificateTier } from "@/lib/api/hooks/use-certificates";

interface CertificateCardProps {
  certificate: Certificate;
  onDownload?: () => void;
  showActions?: boolean;
  className?: string;
}

const tierConfig: Record<CertificateTier, {
  label: string;
  icon: typeof Trophy;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  winner: {
    label: "Winner",
    icon: Trophy,
    bgClass: "bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/30 dark:to-amber-900/30",
    textClass: "text-yellow-700 dark:text-yellow-400",
    borderClass: "border-yellow-300 dark:border-yellow-700",
  },
  excellence: {
    label: "Excellence",
    icon: Star,
    bgClass: "bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-950/30 dark:to-indigo-900/30",
    textClass: "text-purple-700 dark:text-purple-400",
    borderClass: "border-purple-300 dark:border-purple-700",
  },
  completion: {
    label: "Completion",
    icon: Medal,
    bgClass: "bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-950/30 dark:to-cyan-900/30",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-300 dark:border-blue-700",
  },
  participation: {
    label: "Participation",
    icon: Award,
    bgClass: "bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900/30 dark:to-slate-800/30",
    textClass: "text-gray-700 dark:text-gray-400",
    borderClass: "border-gray-300 dark:border-gray-600",
  },
};

export function CertificateCard({
  certificate,
  onDownload,
  showActions = true,
  className,
}: CertificateCardProps) {
  const config = tierConfig[certificate.tier];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 p-6",
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      {/* Decorative corner ribbon for winners */}
      {certificate.tier === "winner" && (
        <div className="absolute -right-8 -top-8 h-24 w-24 rotate-45 bg-yellow-400/20" />
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-full p-2", config.bgClass)}>
              <Icon className={cn("h-6 w-6", config.textClass)} />
            </div>
            <div>
              <p className={cn("text-sm font-medium", config.textClass)}>
                {config.label} Certificate
              </p>
              <p className="text-xs text-muted-foreground">
                {certificate.certificateId}
              </p>
            </div>
          </div>
          {certificate.rank && (
            <div className="text-right">
              <p className="text-2xl font-bold">#{certificate.rank}</p>
              <p className="text-xs text-muted-foreground">Rank</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-4 space-y-2">
          <h3 className="text-lg font-semibold">{certificate.participantName}</h3>
          {certificate.teamName && (
            <p className="text-sm text-muted-foreground">
              Team: {certificate.teamName}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {certificate.cohortName}
            {certificate.verticalName && ` - ${certificate.verticalName}`}
          </p>
        </div>

        {/* Score */}
        {certificate.finalScore !== undefined && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Final Score:</span>
            <span className="font-semibold">{certificate.finalScore}</span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {certificate.verificationUrl && (
              <Button
                size="sm"
                variant="ghost"
                asChild
              >
                <a
                  href={certificate.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Generated date */}
        {certificate.generatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Issued on {new Date(certificate.generatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

export function CertificateTierBadge({ tier }: { tier: CertificateTier }) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bgClass,
        config.textClass
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
