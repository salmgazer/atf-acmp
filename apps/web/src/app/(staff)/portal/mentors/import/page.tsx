"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkImportMentors } from "@/lib/api/hooks/use-mentors";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParsedMentor {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  expertise?: string;
  maxTeams?: string;
  linkedinUrl?: string;
  sessionRateOverride?: string;
  isValid: boolean;
  errors: string[];
}

function ImportContent() {
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMentor[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; email?: string; error: string }>;
  } | null>(null);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  const importMutation = useBulkImportMentors();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("CSV file must have a header row and at least one data row");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const emailIndex = headers.findIndex((h) =>
        ["email", "e-mail", "email address"].includes(h)
      );
      const firstNameIndex = headers.findIndex((h) =>
        ["first name", "firstname", "first_name"].includes(h)
      );
      const lastNameIndex = headers.findIndex((h) =>
        ["last name", "lastname", "last_name"].includes(h)
      );
      const phoneIndex = headers.findIndex((h) =>
        ["phone", "phone number", "phone_number"].includes(h)
      );
      const companyIndex = headers.findIndex((h) =>
        ["company", "organization", "org"].includes(h)
      );
      const titleIndex = headers.findIndex((h) =>
        ["title", "job title", "job_title", "role"].includes(h)
      );
      const expertiseIndex = headers.findIndex((h) =>
        ["expertise", "skills", "areas"].includes(h)
      );
      const maxTeamsIndex = headers.findIndex((h) =>
        ["max teams", "max_teams", "maxteams", "capacity"].includes(h)
      );
      const bioIndex = headers.findIndex((h) =>
        ["bio", "biography", "about"].includes(h)
      );
      const linkedinIndex = headers.findIndex((h) =>
        ["linkedin", "linkedin_url", "linkedinurl", "linkedin url"].includes(h)
      );
      const sessionRateIndex = headers.findIndex((h) =>
        ["session_rate", "session_rate_override", "sessionrateoverride", "rate", "session rate"].includes(h)
      );

      const parsed: ParsedMentor[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const errors: string[] = [];

        const email = emailIndex >= 0 ? values[emailIndex] : "";
        const firstName = firstNameIndex >= 0 ? values[firstNameIndex] : "";
        const lastName = lastNameIndex >= 0 ? values[lastNameIndex] : "";

        if (!email) errors.push("Email is required");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email format");
        if (!firstName) errors.push("First name is required");
        if (!lastName) errors.push("Last name is required");

        parsed.push({
          email,
          firstName,
          lastName,
          phone: phoneIndex >= 0 ? values[phoneIndex] : undefined,
          company: companyIndex >= 0 ? values[companyIndex] : undefined,
          title: titleIndex >= 0 ? values[titleIndex] : undefined,
          bio: bioIndex >= 0 ? values[bioIndex] : undefined,
          expertise: expertiseIndex >= 0 ? values[expertiseIndex] : undefined,
          maxTeams: maxTeamsIndex >= 0 ? values[maxTeamsIndex] : undefined,
          linkedinUrl: linkedinIndex >= 0 ? values[linkedinIndex] : undefined,
          sessionRateOverride: sessionRateIndex >= 0 ? values[sessionRateIndex] : undefined,
          isValid: errors.length === 0,
          errors,
        });
      }

      setParsedData(parsed);
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleImport = async () => {
    if (!selectedCohortId || !file) {
      toast.error("Please select a cohort and upload a file");
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        cohortId: selectedCohortId,
        file,
      });
      setImportResults(result);
      setShowResultsDialog(true);
    } catch (error: any) {
      toast.error(error.message || "Import failed");
    }
  };

  const downloadTemplate = () => {
    const template = `email,first_name,last_name,phone,company,title,bio,expertise,max_teams,linkedin_url,session_rate
john.doe@example.com,John,Doe,+1234567890,TechCorp,Senior Engineer,"10+ years in software development","AI, Machine Learning, Python",3,https://linkedin.com/in/johndoe,
jane.smith@example.com,Jane,Smith,+0987654321,StartupInc,Product Manager,"Experienced product leader","Product Strategy, UX, Agile",4,https://linkedin.com/in/janesmith,50`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mentors_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedData.filter((p) => p.isValid).length;
  const invalidCount = parsedData.filter((p) => !p.isValid).length;

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/portal/mentors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import Mentors</h1>
            <p className="text-muted-foreground">
              Bulk import mentors from a CSV file
            </p>
          </div>
        </div>

        {/* Step 1: Select Cohort */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Step 1: Select Cohort</h2>
          <div className="max-w-md">
            <Label>Cohort</Label>
            <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a cohort" />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Step 2: Upload File */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Step 2: Upload CSV File</h2>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              file ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-muted-foreground/30"
            )}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              {file ? (
                <>
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-green-600" />
                  <p className="mt-2 font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Click to upload a different file
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 font-medium">Click to upload CSV</p>
                  <p className="text-sm text-muted-foreground">
                    or drag and drop your file here
                  </p>
                </>
              )}
            </label>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p className="font-medium">Required columns:</p>
            <ul className="list-disc list-inside mt-1">
              <li>email - Mentor&apos;s email address</li>
              <li>first_name - First name</li>
              <li>last_name - Last name</li>
            </ul>
            <p className="font-medium mt-2">Optional columns:</p>
            <ul className="list-disc list-inside mt-1">
              <li>phone - Phone number</li>
              <li>company - Company/Organization</li>
              <li>title - Job title</li>
              <li>bio - Short biography</li>
              <li>expertise - Comma-separated skills</li>
              <li>max_teams - Maximum teams (default: 3)</li>
              <li>linkedin_url - LinkedIn profile URL</li>
              <li>session_rate - Session rate override ($)</li>
            </ul>
          </div>
        </div>

        {/* Preview */}
        {parsedData.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Step 3: Preview & Import</h2>
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    {invalidCount} invalid
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Company</th>
                    <th className="text-left p-3 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((mentor, i) => (
                    <tr key={i} className={cn("border-b", !mentor.isValid && "bg-red-50 dark:bg-red-900/10")}>
                      <td className="p-3">
                        {mentor.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td className="p-3">{mentor.email || "-"}</td>
                      <td className="p-3">
                        {mentor.firstName || mentor.lastName
                          ? `${mentor.firstName} ${mentor.lastName}`.trim()
                          : "-"}
                      </td>
                      <td className="p-3">{mentor.company || "-"}</td>
                      <td className="p-3">
                        {mentor.errors.length > 0 && (
                          <span className="text-red-500 text-xs">
                            {mentor.errors.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleImport}
                disabled={!selectedCohortId || validCount === 0 || importMutation.isPending}
              >
                {importMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Import {validCount} Mentors
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          {importResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {importResults.success}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Successfully imported
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {importResults.failed}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Failed
                  </div>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Errors
                  </h4>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border p-2 text-sm">
                    {importResults.errors.map((err, i) => (
                      <div key={i} className="py-1 border-b last:border-0">
                        <span className="text-muted-foreground">Row {err.row}:</span>{" "}
                        {err.email && <span className="font-medium">{err.email}</span>}{" "}
                        - {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button asChild>
              <Link href="/portal/mentors">View All Mentors</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function ImportMentorsPage() {
  return (
    <ProtectedRoute portal="staff">
      <ImportContent />
    </ProtectedRoute>
  );
}
