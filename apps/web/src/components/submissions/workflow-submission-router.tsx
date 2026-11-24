"use client";
import { WarmupSubmissionForm } from "./warmup-submission-form";
import Link from "next/link";
import { useStage } from "@/lib/api/hooks/use-stages";
import { ProgrammeSubmissionForm } from "./programme-submission-form";
export function WorkflowSubmissionRouter({ stageId }: { stageId: string }) {
  const { data: stage, isLoading, isError } = useStage(stageId);
  if (isLoading) return <p>Loading step…</p>;
  if (isError || !stage) return <p role="alert">Could not load this step. Please retry.</p>;
  if (stage.workflowKey === "warmup") return <WarmupSubmissionForm stageId={stageId} />;
  if (stage.workflowKey === "proposal" || stage.workflowKey === "build") return <ProgrammeSubmissionForm kind={stage.workflowKey} stageId={stageId} />;
  return <p>This step has no submission form. Historical submissions remain available to staff. <Link href="/participant/submissions" className="underline">View the six steps</Link></p>;
}
