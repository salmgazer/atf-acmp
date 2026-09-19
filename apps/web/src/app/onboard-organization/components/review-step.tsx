"use client";

import { useTheme } from "next-themes";
import { ArrowLeft, Send, Building2, Lightbulb, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormState } from "../types";
import { calculateScores, getFitBandLabel, getImpactBandLabel, getFitBandColor } from "../scoring";
import { cn } from "@/lib/utils";

interface ReviewStepProps {
  formState: FormState;
  consentGiven: boolean;
  setConsentGiven: (value: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  isSubmitting: boolean;
  submitError: string | null;
}

export function ReviewStep({
  formState,
  consentGiven,
  setConsentGiven,
  onSubmit,
  onBack,
  onEdit,
  isSubmitting,
  submitError,
}: ReviewStepProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { org, opportunities } = formState;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1B2A4A] dark:text-white">Review Your Submission</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Please review your information before submitting. You can edit any section by clicking the edit button.
        </p>
      </div>

      {/* Organisation Summary */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#17A589]" />
            <h3 className="font-medium text-[#1B2A4A] dark:text-white">Organisation Details</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(1)} className="gap-1 text-slate-600 dark:text-slate-300 dark:hover:bg-slate-600">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        </div>
        <div className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Organisation Name</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{org.orgName}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Sector</dt>
              <dd className="font-medium text-slate-900 dark:text-white">
                {org.sector === "Other" ? org.sectorOther : org.sector}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Location</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{org.city}, {org.country}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Contact Person</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{org.contactName}</dd>
              <dd className="text-sm text-slate-600 dark:text-slate-400">{org.designation}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{org.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Phone</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{org.phone}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Opportunities Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[#E8913A]" />
            <h3 className="font-medium text-[#1B2A4A] dark:text-white">
              AI Opportunities ({opportunities.length})
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(2)} className="gap-1 text-slate-600 dark:text-slate-300 dark:hover:bg-slate-600">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        </div>

        {opportunities.map((opp, index) => {
          const scores = calculateScores(opp.scoringAnswers);
          const colors = getFitBandColor(scores.fitBand);

          return (
            <div
              key={index}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Opportunity {index + 1}
                    </span>
                    <h4 className="font-semibold text-lg text-[#1B2A4A] dark:text-white">{opp.title}</h4>
                  </div>
                  <div className={cn("px-3 py-1 rounded-full text-sm font-medium", colors.bg, colors.text)}>
                    {getFitBandLabel(scores.fitBand)}
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">{opp.description}</p>

                {/* Scores */}
                <div className="flex gap-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Fit Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-slate-800 dark:text-white">{scores.fitScore}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">/ 100</span>
                    </div>
                  </div>
                  {scores.impactScore && (
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Impact Score</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-slate-800 dark:text-white">{scores.impactScore}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">/ 9</span>
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          ({getImpactBandLabel(scores.impactBand)})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Override warning */}
                {scores.scoreOverride && (
                  <div className="mt-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-700 dark:text-orange-300">{scores.scoreOverride}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Consent */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="consent"
            checked={consentGiven}
            onCheckedChange={(checked) => setConsentGiven(checked === true)}
            className="mt-1"
          />
          <div>
            <Label htmlFor="consent" className="font-medium text-slate-900 dark:text-white cursor-pointer">
              I consent to the processing of this information
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              By submitting this form, you agree that the Africa Technology Foundation may use this 
              information to evaluate AI opportunities and contact your organisation about potential 
              participation in the AI Challenge program.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!consentGiven || isSubmitting}
          className="bg-[#17A589] hover:bg-[#17A589]/90 gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Brief{opportunities.length > 1 ? "s" : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
