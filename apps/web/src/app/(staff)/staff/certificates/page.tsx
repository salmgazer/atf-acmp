"use client";

import { useState } from "react";
import {
  Award,
  Trophy,
  Star,
  Medal,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CertificateTierBadge } from "@/components/certificates";
import {
  useAdminCertificates,
  useCertificateStats,
  useGenerateCertificates,
  useUpdateCertificateTier,
  useRegenerateCertificate,
  useDeleteCertificate,
  type CertificateTier,
  type Certificate,
} from "@/lib/api/hooks/use-certificates";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";

export default function AdminCertificatesPage() {
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<CertificateTier | "all">("all");
  const [page, setPage] = useState(0);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  const { data: cohortsData } = useCohorts();
  const { data: certificatesData, isLoading: loadingCertificates } = useAdminCertificates({
    cohortId: selectedCohortId,
    tier: tierFilter === "all" ? undefined : tierFilter,
    limit: 20,
    offset: page * 20,
  });
  const { data: stats, isLoading: loadingStats } = useCertificateStats(selectedCohortId);

  const generateMutation = useGenerateCertificates();
  const updateTierMutation = useUpdateCertificateTier();
  const regenerateMutation = useRegenerateCertificate();
  const deleteMutation = useDeleteCertificate();

  const handleGenerate = async () => {
    if (!selectedCohortId) return;
    await generateMutation.mutateAsync({ cohortId: selectedCohortId });
    setGenerateDialogOpen(false);
  };

  const handleUpdateTier = async (id: string, tier: CertificateTier) => {
    await updateTierMutation.mutateAsync({ id, tier });
  };

  const handleRegenerate = async (id: string) => {
    await regenerateMutation.mutateAsync(id);
  };

  const handleDelete = async () => {
    if (!selectedCertificate) return;
    await deleteMutation.mutateAsync(selectedCertificate.id);
    setDeleteDialogOpen(false);
    setSelectedCertificate(null);
  };

  const statCards = [
    {
      label: "Total Certificates",
      value: stats?.total ?? 0,
      icon: Award,
      color: "text-blue-600",
    },
    {
      label: "Winners",
      value: stats?.byTier?.winner ?? 0,
      icon: Trophy,
      color: "text-yellow-600",
    },
    {
      label: "Excellence",
      value: stats?.byTier?.excellence ?? 0,
      icon: Star,
      color: "text-purple-600",
    },
    {
      label: "Completion",
      value: stats?.byTier?.completion ?? 0,
      icon: Medal,
      color: "text-green-600",
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Certificate Management</h1>
          <p className="text-muted-foreground">
            Generate and manage participant certificates
          </p>
        </div>
        <Button
          onClick={() => setGenerateDialogOpen(true)}
          disabled={!selectedCohortId}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Generate Certificates
        </Button>
      </div>

      {/* Cohort Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Cohort</CardTitle>
          <CardDescription>
            Choose a cohort to view and manage certificates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohortsData?.data?.map((cohort: { id: string; name: string }) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCohortId && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      {loadingStats ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold">{stat.value}</p>
                      )}
                    </div>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <Select
              value={tierFilter}
              onValueChange={(v) => setTierFilter(v as CertificateTier | "all")}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="winner">Winner</SelectItem>
                <SelectItem value="excellence">Excellence</SelectItem>
                <SelectItem value="completion">Completion</SelectItem>
                <SelectItem value="participation">Participation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Certificates Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate ID</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCertificates ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : certificatesData?.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No certificates found. Generate certificates to get started.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    certificatesData?.data?.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-mono text-xs">
                          {cert.certificateId}
                        </TableCell>
                        <TableCell>{cert.participantName}</TableCell>
                        <TableCell>{cert.teamName || "-"}</TableCell>
                        <TableCell>
                          <CertificateTierBadge tier={cert.tier} />
                        </TableCell>
                        <TableCell>{cert.rank || "-"}</TableCell>
                        <TableCell>{cert.finalScore?.toFixed(1) || "-"}</TableCell>
                        <TableCell>{cert.downloadCount}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRegenerate(cert.id)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCertificate(cert);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {certificatesData && certificatesData.meta.total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * 20 + 1} to{" "}
                {Math.min((page + 1) * 20, certificatesData.meta.total)} of{" "}
                {certificatesData.meta.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * 20 >= certificatesData.meta.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Certificates</DialogTitle>
            <DialogDescription>
              This will generate certificates for all eligible participants in the
              selected cohort. Tiers will be automatically assigned based on final
              scores and rankings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p><strong>Tier Assignment:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Winner: Ranks 1-3</li>
                <li>Excellence: Score ≥ 80</li>
                <li>Completion: Score ≥ 50</li>
                <li>Participation: All others</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Certificate</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this certificate? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
