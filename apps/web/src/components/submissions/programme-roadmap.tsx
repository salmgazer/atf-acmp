"use client";

import Link from "next/link";
import { CheckCircle, ChevronRight, Clock, Lock } from "lucide-react";
import type { TeamWorkflowProgress } from "@/lib/api/hooks/use-team-workflow";
import { formatUtcDeadline } from "@/lib/utc-deadline";
import { cn } from "@/lib/utils";

type WorkflowStep = TeamWorkflowProgress["steps"][number];

const unlockMessages: Record<WorkflowStep["key"], string> = {
  team: "Form or join a team to begin.",
  problem: "Form or join a team first.",
  proposal: "Available once your team's problem brief is approved and assigned.",
  warmup: "Available after proposal submission and all members complete learning.",
  evaluation: "Requires a submitted proposal and a successfully deployed warmup web app.",
  build: "Available after your proposal is submitted, the warmup passes AI evaluation and learning checks pass.",
};

export function workflowStepState(step: WorkflowStep) {
  const opensLater = !step.completed && !!step.startDate && Date.parse(step.startDate) > Date.now();
  const locked = !step.completed && (step.status === "locked" || opensLater);
  return {
    locked,
    label: step.completed ? "Completed" : locked ? "Upcoming · Locked" : step.key === "evaluation" ? "Awaiting evaluation" : "In progress",
    explanation: opensLater ? `Opens ${formatUtcDeadline(step.startDate)}` : unlockMessages[step.key],
  };
}

function stepHref(step: WorkflowStep, progress: TeamWorkflowProgress) {
  if (step.key === "team") return "/participant/team";
  if (step.key === "problem") return progress.team?.briefPreference === "own" ? "/participant/briefs/own" : "/participant/briefs";
  if ((step.key === "proposal" || step.key === "warmup" || step.key === "build") && step.stageId) return `/participant/submissions/${step.stageId}`;
  return "/participant/submissions";
}

export function ProgrammeRoadmap({ progress }: { progress: TeamWorkflowProgress }) {
  return <section aria-label="Programme roadmap" className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold">Your programme roadmap</h2>
        <p className="mt-1 text-sm text-muted-foreground">All six stages, from forming your team to submitting your MVP.</p>
      </div>
      <Link href="/participant/submissions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">View details<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
    </div>
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {progress.steps.map(step => {
        const state = workflowStepState(step);
        const Icon = step.completed ? CheckCircle : state.locked ? Lock : Clock;
        return <li key={step.key} data-state={state.locked ? "locked" : step.completed ? "completed" : "current"} aria-current={!step.completed && !state.locked ? "step" : undefined} className={cn("flex min-w-0 flex-col gap-3 rounded-lg border p-4", state.locked ? "bg-muted/50 text-muted-foreground" : step.completed ? "bg-background" : "border-primary/40 bg-primary/5")}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", state.locked ? "bg-muted" : step.completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-primary text-primary-foreground")}>{step.number}</span>
            <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", step.completed && "text-emerald-600 dark:text-emerald-400")} />
          </div>
          <h3 className="text-sm font-semibold">{step.name}</h3>
          <span className="text-xs font-medium">{state.label}</span>
          {step.deadline && <p className="text-xs">Deadline: {formatUtcDeadline(step.deadline)}</p>}
          {state.locked ? <p className="text-xs leading-relaxed">{state.explanation}</p> : <Link href={stepHref(step, progress)} className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary hover:underline">{step.completed || step.key === "evaluation" ? "View stage" : "Continue"}<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>}
        </li>;
      })}
    </ol>
  </section>;
}
