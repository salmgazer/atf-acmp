"use client";
import { use } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ProposalReview } from "@/components/submissions/proposal-review";
export default function ProposalReviewPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <ProtectedRoute portal="staff"><StaffLayout><ProposalReview submissionId={id} /></StaffLayout></ProtectedRoute>; }
