"use client";

import { use } from "react";
import { CheckCircle, XCircle, Award, Trophy, Star, Medal, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVerifyCertificate, type CertificateTier } from "@/lib/api/hooks/use-certificates";
import { cn } from "@/lib/utils";

const tierConfig: Record<CertificateTier, {
  label: string;
  icon: typeof Trophy;
  color: string;
  bgColor: string;
}> = {
  winner: {
    label: "Winner",
    icon: Trophy,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
  },
  excellence: {
    label: "Excellence",
    icon: Star,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  completion: {
    label: "Completion",
    icon: Medal,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  participation: {
    label: "Participation",
    icon: Award,
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-900/30",
  },
};

interface PageProps {
  params: Promise<{ certificateId: string }>;
}

export default function CertificateVerificationPage({ params }: PageProps) {
  const { certificateId } = use(params);
  const { data, isLoading, error } = useVerifyCertificate(certificateId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Verifying certificate...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="rounded-full bg-red-100 p-4 dark:bg-red-950/30">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Verification Failed</h2>
            <p className="mt-2 text-center text-muted-foreground">
              Unable to verify this certificate. It may not exist or has been revoked.
            </p>
            <p className="mt-4 font-mono text-sm text-muted-foreground">
              ID: {certificateId}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data.valid || !data.certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="rounded-full bg-red-100 p-4 dark:bg-red-950/30">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Invalid Certificate</h2>
            <p className="mt-2 text-center text-muted-foreground">
              This certificate could not be verified. It may be invalid or has been revoked.
            </p>
            <p className="mt-4 font-mono text-sm text-muted-foreground">
              ID: {certificateId}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { certificate } = data;
  const config = tierConfig[certificate.tier];
  const Icon = config.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center border-b">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-950/30">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-green-600">Certificate Verified</CardTitle>
          <p className="text-sm text-muted-foreground">
            This certificate is authentic and valid
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Tier Badge */}
          <div className={cn("rounded-lg p-4 mb-6", config.bgColor)}>
            <div className="flex items-center justify-center gap-3">
              <Icon className={cn("h-8 w-8", config.color)} />
              <span className={cn("text-xl font-semibold", config.color)}>
                {config.label} Certificate
              </span>
            </div>
          </div>

          {/* Certificate Details */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Awarded to</p>
              <p className="text-lg font-semibold">{certificate.participantName}</p>
            </div>

            {certificate.teamName && (
              <div>
                <p className="text-sm text-muted-foreground">Team</p>
                <p className="font-medium">{certificate.teamName}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Program</p>
              <p className="font-medium">{certificate.cohortName}</p>
            </div>

            {certificate.rank && (
              <div>
                <p className="text-sm text-muted-foreground">Ranking</p>
                <p className="font-medium">#{certificate.rank}</p>
              </div>
            )}

            {certificate.generatedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Issued on</p>
                <p className="font-medium">
                  {new Date(certificate.generatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Certificate ID: {certificate.certificateId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
