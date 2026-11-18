"use client";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ProgrammeSubmissionForm } from "@/components/submissions/programme-submission-form";
export default function OwnBriefPage() { return <ProtectedRoute portal="participant"><ParticipantLayout><ProgrammeSubmissionForm kind="brief" /></ParticipantLayout></ProtectedRoute>; }
