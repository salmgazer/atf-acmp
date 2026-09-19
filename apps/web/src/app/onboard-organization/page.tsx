"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { FormState, createInitialFormState } from "./types";
import { StepIndicator } from "./components/step-indicator";
import { OrganizationStep } from "./components/organization-step";
import { OpportunityStep } from "./components/opportunity-step";
import { ScoringStep } from "./components/scoring-step";
import { ReviewStep } from "./components/review-step";
import { SuccessStep } from "./components/success-step";
import { ThemeToggle } from "./components/theme-toggle";

const STEPS = [
  { id: 1, name: "Organisation", description: "Your details" },
  { id: 2, name: "Opportunity", description: "The problem" },
  { id: 3, name: "Fit Questions", description: "Quick assessment" },
  { id: 4, name: "Review", description: "Check & submit" },
];

export default function OnboardOrganizationPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formState, setFormState] = useState<FormState>(createInitialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const updateOrg = useCallback((updates: Partial<FormState["org"]>) => {
    setFormState((prev) => ({
      ...prev,
      org: { ...prev.org, ...updates },
    }));
  }, []);

  const updateOpportunity = useCallback((index: number, updates: Partial<FormState["opportunities"][0]>) => {
    setFormState((prev) => {
      const opportunities = [...prev.opportunities];
      opportunities[index] = { ...opportunities[index], ...updates };
      return { ...prev, opportunities };
    });
  }, []);

  const addOpportunity = useCallback(() => {
    setFormState((prev) => {
      if (prev.opportunities.length >= 3) return prev;
      return {
        ...prev,
        opportunities: [
          ...prev.opportunities,
          {
            title: "",
            description: "",
            whatChanges: "",
            howMany: "",
            dataDescription: "",
            dataAccess: "",
            secondaryContact: { name: "", role: "", email: "", phone: "" },
            scoringAnswers: { q1: "", q2: "", q3: "", q4: "", q5: "", q6: "", q7: "", q8: "" },
          },
        ],
      };
    });
  }, []);

  const removeOpportunity = useCallback((index: number) => {
    setFormState((prev) => {
      if (prev.opportunities.length <= 1) return prev;
      return {
        ...prev,
        opportunities: prev.opportunities.filter((_, i) => i !== index),
      };
    });
  }, []);

  const setConsentGiven = useCallback((value: boolean) => {
    setFormState((prev) => ({ ...prev, consentGiven: value }));
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Clean up the form data before submission
      const cleanedFormState = {
        ...formState,
        opportunities: formState.opportunities.map((opp) => {
          // Only include secondaryContact if at least one field has a value
          const hasSecondaryContact = opp.secondaryContact && (
            opp.secondaryContact.name?.trim() ||
            opp.secondaryContact.role?.trim() ||
            opp.secondaryContact.email?.trim() ||
            opp.secondaryContact.phone?.trim()
          );
          
          return {
            ...opp,
            secondaryContact: hasSecondaryContact ? {
              name: opp.secondaryContact?.name?.trim() || undefined,
              role: opp.secondaryContact?.role?.trim() || undefined,
              email: opp.secondaryContact?.email?.trim() || undefined,
              phone: opp.secondaryContact?.phone?.trim() || undefined,
            } : undefined,
          };
        }),
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${apiUrl}/public/organization-briefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedFormState),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Submission failed");
      }

      if (result.duplicate) {
        setSubmitError("This form has already been submitted.");
        return;
      }

      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step);
    }
  };

  if (isSubmitted) {
    return (
      <SuccessStep
        orgName={formState.org.orgName}
        opportunityCount={formState.opportunities.length}
        opportunityTitles={formState.opportunities.map((opp) => opp.title)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-20">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Image
              src="/logos/full/Full-color-logo.png"
              alt="Africa Technology Foundation"
              width={180}
              height={48}
              className="h-10 w-auto dark:hidden"
              priority
            />
            <Image
              src="/logos/full/Bright-color-logo.png"
              alt="Africa Technology Foundation"
              width={180}
              height={48}
              className="h-10 w-auto hidden dark:block"
              priority
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Progress Steps - also sticky, positioned below header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-[73px] z-10">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />
        </div>
      </div>

      {/* Form Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        {currentStep === 1 && (
          <OrganizationStep
            org={formState.org}
            updateOrg={updateOrg}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <OpportunityStep
            opportunities={formState.opportunities}
            updateOpportunity={updateOpportunity}
            addOpportunity={addOpportunity}
            removeOpportunity={removeOpportunity}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <ScoringStep
            opportunities={formState.opportunities}
            updateOpportunity={updateOpportunity}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <ReviewStep
            formState={formState}
            consentGiven={formState.consentGiven}
            setConsentGiven={setConsentGiven}
            onSubmit={handleSubmit}
            onBack={() => setCurrentStep(3)}
            onEdit={goToStep}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Africa Technology Foundation © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
