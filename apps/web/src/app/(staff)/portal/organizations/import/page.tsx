"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useBulkImportOrganizations,
  type BulkImportOrganizationRow,
  type ImportResult,
} from "@/lib/api/hooks/use-organizations";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";

function parseCSV(text: string): BulkImportOrganizationRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: BulkImportOrganizationRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length < 2) continue;

    const row: BulkImportOrganizationRow = {
      name: "",
      email: "",
    };

    headers.forEach((header, idx) => {
      const value = values[idx] || "";
      switch (header) {
        case "name":
        case "organization":
        case "company":
          row.name = value;
          break;
        case "email":
          row.email = value;
          break;
        case "contact":
        case "contactperson":
        case "contact_person":
          row.contactPerson = value;
          break;
        case "phone":
        case "contactphone":
        case "contact_phone":
          row.contactPhone = value;
          break;
        case "country":
          row.country = value;
          break;
        case "industry":
          row.industry = value;
          break;
        case "website":
          row.website = value;
          break;
      }
    });

    if (row.name && row.email) {
      rows.push(row);
    }
  }

  return rows;
}

function ImportOrganizationsContent() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<BulkImportOrganizationRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const importMutation = useBulkImportOrganizations();

  const handleTextChange = (text: string) => {
    setCsvText(text);
    const rows = parseCSV(text);
    setParsedRows(rows);
    setImportResults(null);
  };

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleTextChange(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    const result = await importMutation.mutateAsync(parsedRows);
    setImportResults(result.results);
  };

  const downloadTemplate = () => {
    const template = "name,email,contactPerson,contactPhone,country,industry,website\nAcme Corp,contact@acme.com,John Doe,+1234567890,United States,Technology,https://acme.com";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "organizations_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const successCount = importResults?.filter((r) => r.success).length || 0;
  const failureCount = importResults?.filter((r) => !r.success).length || 0;

  return (
    <StaffLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/portal/organizations"
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Import Organizations</h1>
            <p className="text-sm text-muted-foreground">
              Bulk import organizations from CSV file or paste data directly
            </p>
          </div>
        </div>

        {/* Template Download */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">CSV Template</p>
              <p className="text-sm text-muted-foreground">
                Download template with required columns
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        {/* File Upload / Text Input */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">
              Drag and drop your CSV file here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse files
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-4 text-muted-foreground">
                or paste CSV data
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">CSV Data</Label>
            <Textarea
              placeholder="name,email,contactPerson,country,industry&#10;Acme Corp,contact@acme.com,John Doe,Ghana,Technology"
              value={csvText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* Preview */}
        {parsedRows.length > 0 && !importResults && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">
                Preview ({parsedRows.length} organizations)
              </h2>
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <Upload className="h-4 w-4" />
                Import All
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-t border-border/50">
                      <td className="p-3 text-foreground">{row.name}</td>
                      <td className="p-3 text-muted-foreground">{row.email}</td>
                      <td className="p-3 text-muted-foreground">{row.contactPerson || "—"}</td>
                      <td className="p-3 text-muted-foreground">{row.country || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t border-border/50">
                  ... and {parsedRows.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {importResults && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">Import Results</h2>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  {successCount} imported
                </span>
                {failureCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    {failureCount} failed
                  </span>
                )}
              </div>
            </div>

            {failureCount > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Some imports failed</p>
                    <ul className="mt-2 space-y-1 text-sm text-red-700">
                      {importResults
                        .filter((r) => !r.success)
                        .map((r, idx) => (
                          <li key={idx}>
                            <strong>{r.name}</strong> ({r.email}): {r.error}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCsvText("");
                  setParsedRows([]);
                  setImportResults(null);
                }}
              >
                Import More
              </Button>
              <Link href="/portal/organizations">
                <Button>View Organizations</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  );
}

export default function ImportOrganizationsPage() {
  return (
    <ProtectedRoute portal="staff">
      <ImportOrganizationsContent />
    </ProtectedRoute>
  );
}
