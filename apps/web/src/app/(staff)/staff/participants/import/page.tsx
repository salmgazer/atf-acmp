"use client";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StaffLayout } from "@/components/layouts";
import { StaffOnly } from "@/components/auth/staff-only";
import { ParticipantImportPanel } from "@/components/participants/participant-import-panel";

export default function ParticipantImportPage() {
  return <ProtectedRoute portal="staff"><StaffLayout><StaffOnly permission="manage"><ParticipantImportPanel /></StaffOnly></StaffLayout></ProtectedRoute>;
}
