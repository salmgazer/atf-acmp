"use client";

import { Award, Download } from "lucide-react";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CertificateCard } from "@/components/certificates";
import { useMyCertificates } from "@/lib/api/hooks/use-certificates";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";

function CertificatesContent() {
  const { data: certificates, isLoading } = useMyCertificates();

  const handleDownload = async (certificateId: string) => {
    try {
      const response = await api.get<{ pdfUrl?: string }>(`/certificates/my/${certificateId}/download`);
      if ((response as any)?.pdfUrl) {
        window.open((response as any).pdfUrl, "_blank");
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (isLoading) {
    return (
      <ParticipantLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </ParticipantLayout>
    );
  }

  const hasCertificates = certificates && certificates.length > 0;

  return (
    <ParticipantLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Certificates</h1>
          <p className="text-muted-foreground">
            View and download your earned certificates
          </p>
        </div>

        {!hasCertificates ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <Award className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No certificates yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              Certificates are issued after program completion. Keep working on your
              submissions to earn your certificate.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((certificate) => (
              <CertificateCard
                key={certificate.id}
                certificate={certificate}
                onDownload={() => handleDownload(certificate.certificateId)}
              />
            ))}
          </div>
        )}
      </div>
    </ParticipantLayout>
  );
}

export default function ParticipantCertificatesPage() {
  return (
    <ProtectedRoute portal="participant">
      <CertificatesContent />
    </ProtectedRoute>
  );
}
