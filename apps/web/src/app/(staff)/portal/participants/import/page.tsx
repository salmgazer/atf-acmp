"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useBulkImportParticipants,
  type BulkImportRow,
  type ImportResult,
} from "@/lib/api/hooks/use-participants";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ParsedParticipant extends BulkImportRow {
  rowNumber: number;
  errors: string[];
  isValid: boolean;
}

function parseCSV(content: string): ParsedParticipant[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  // Parse header
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const requiredFields = ["participantid", "email", "firstname", "lastname", "country"];
  
  const fieldMap: Record<string, number> = {};
  header.forEach((h, i) => {
    // Handle variations in header names
    const normalized = h.replace(/[_\s-]/g, "").toLowerCase();
    if (normalized === "participantid" || normalized === "id") fieldMap["participantId"] = i;
    else if (normalized === "email") fieldMap["email"] = i;
    else if (normalized === "firstname" || normalized === "first") fieldMap["firstName"] = i;
    else if (normalized === "lastname" || normalized === "last") fieldMap["lastName"] = i;
    else if (normalized === "country") fieldMap["country"] = i;
    else if (normalized === "institution" || normalized === "school" || normalized === "university")
      fieldMap["institution"] = i;
    else if (normalized === "phone" || normalized === "phonenumber") fieldMap["phoneNumber"] = i;
  });

  const results: ParsedParticipant[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const errors: string[] = [];

    const participantId = values[fieldMap["participantId"]]?.trim() || "";
    const email = values[fieldMap["email"]]?.trim() || "";
    const firstName = values[fieldMap["firstName"]]?.trim() || "";
    const lastName = values[fieldMap["lastName"]]?.trim() || "";
    const country = values[fieldMap["country"]]?.trim() || "";
    const institution = values[fieldMap["institution"]]?.trim() || undefined;
    const phoneNumber = values[fieldMap["phoneNumber"]]?.trim() || undefined;

    // Validate
    if (!participantId) errors.push("Missing participant ID");
    if (!email) errors.push("Missing email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email format");
    if (!firstName) errors.push("Missing first name");
    if (!lastName) errors.push("Missing last name");
    if (!country) errors.push("Missing country");

    results.push({
      rowNumber: i + 1,
      participantId,
      email,
      firstName,
      lastName,
      country,
      institution,
      phoneNumber,
      errors,
      isValid: errors.length === 0,
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map((v) => v.trim().replace(/^"|"$/g, ""));
}

function BulkImportContent() {
  const router = useRouter();
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [parsedData, setParsedData] = useState<ParsedParticipant[]>([]);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];
  const activeCohort = cohorts.find((c) => c.status === "active");

  const importMutation = useBulkImportParticipants();

  const validCount = useMemo(
    () => parsedData.filter((p) => p.isValid).length,
    [parsedData]
  );
  const invalidCount = useMemo(
    () => parsedData.filter((p) => !p.isValid).length,
    [parsedData]
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsed = parseCSV(content);
        setParsedData(parsed);
        setImportResults(null);
      };
      reader.readAsText(file);

      // Reset input
      event.target.value = "";
    },
    []
  );

  const handleImport = async () => {
    if (!selectedCohortId || validCount === 0) return;

    const validParticipants = parsedData
      .filter((p) => p.isValid)
      .map(({ rowNumber, errors, isValid, ...rest }) => rest);

    const result = await importMutation.mutateAsync({
      cohortId: selectedCohortId,
      participants: validParticipants,
      sendWelcomeEmail,
    });

    setImportResults(result.results);
    setShowResultsDialog(true);
  };

  const handleClear = () => {
    setParsedData([]);
    setImportResults(null);
  };

  const downloadTemplate = () => {
    const template =
      "participantId,email,firstName,lastName,country,institution,phoneNumber\n" +
      "P001,john.doe@example.com,John,Doe,Kenya,University of Nairobi,+254700000001\n" +
      "P002,jane.smith@example.com,Jane,Smith,Nigeria,University of Lagos,+234800000001";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participants_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/portal/participants">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bulk Import Participants</h1>
            <p className="text-muted-foreground">
              Upload a CSV file to import multiple participants at once
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-4 border-blue-200">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-2">Import Instructions:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>CSV must include: participantId, email, firstName, lastName, country</li>
                <li>Optional fields: institution, phoneNumber</li>
                <li>Initial password will be set to the participant ID</li>
                <li>Participants will receive a welcome email with login instructions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">1. Select Cohort</h2>
            <Select
              value={selectedCohortId}
              onValueChange={setSelectedCohortId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a cohort" />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.name}
                    {cohort.status === "active" && (
                      <Badge variant="default" className="ml-2">Active</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">2. Upload CSV File</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
                <Label
                  htmlFor="csv-upload"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload CSV
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        {parsedData.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">3. Import Options</h2>
            <div className="flex items-center gap-2">
              <Checkbox
                id="send-email"
                checked={sendWelcomeEmail}
                onCheckedChange={(checked) => setSendWelcomeEmail(checked as boolean)}
              />
              <Label htmlFor="send-email" className="cursor-pointer">
                Send welcome email to participants with login instructions
              </Label>
            </div>
          </div>
        )}

        {/* Preview */}
        {parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Preview ({parsedData.length} rows)</h2>
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800">
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClear}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedCohortId || validCount === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import {validCount} Participants
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participant ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row) => (
                      <TableRow
                        key={row.rowNumber}
                        className={cn(!row.isValid && "bg-red-50 dark:bg-red-900/10")}
                      >
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.participantId || "—"}</TableCell>
                        <TableCell className="text-sm">{row.email || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {row.firstName || row.lastName
                            ? `${row.firstName} ${row.lastName}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{row.country || "—"}</TableCell>
                        <TableCell className="text-sm">{row.institution || "—"}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <span className="text-xs text-red-600">
                              {row.errors.join(", ")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {parsedData.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No data to preview</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a CSV file to see a preview of participants to import
            </p>
          </div>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
            <DialogDescription>
              {importResults && (
                <>
                  Successfully imported {importResults.filter((r) => r.success).length} of{" "}
                  {importResults.length} participants
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {importResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {importResults.filter((r) => r.success).length} succeeded
                </Badge>
                {importResults.filter((r) => !r.success).length > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    {importResults.filter((r) => !r.success).length} failed
                  </Badge>
                )}
              </div>

              {/* Failed imports */}
              {importResults.filter((r) => !r.success).length > 0 && (
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium text-red-600 mb-2">Failed Imports</h4>
                  <div className="space-y-2 max-h-[200px] overflow-auto">
                    {importResults
                      .filter((r) => !r.success)
                      .map((result, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded"
                        >
                          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">{result.participantId}</span>
                            <span className="text-muted-foreground"> ({result.email})</span>
                            {result.error && (
                              <p className="text-red-600">{result.error}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultsDialog(false)}>
              Close
            </Button>
            <Button onClick={() => router.push("/portal/participants")}>
              View Participants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function BulkImportPage() {
  return (
    <ProtectedRoute portal="staff">
      <BulkImportContent />
    </ProtectedRoute>
  );
}
