"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, Lightbulb, Users, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { Opportunity } from "../types";

interface OpportunityStepProps {
  opportunities: Opportunity[];
  updateOpportunity: (index: number, updates: Partial<Opportunity>) => void;
  addOpportunity: () => void;
  removeOpportunity: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function OpportunityStep({
  opportunities,
  updateOpportunity,
  addOpportunity,
  removeOpportunity,
  onNext,
  onBack,
}: OpportunityStepProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [errors, setErrors] = useState<Record<number, Partial<Record<keyof Opportunity, string>>>>({});

  const opp = opportunities[activeIndex];

  const validateCurrent = (): boolean => {
    const newErrors: Partial<Record<keyof Opportunity, string>> = {};

    if (!opp.title.trim()) newErrors.title = "Title is required";
    if (!opp.description.trim()) newErrors.description = "Description is required";
    if (opp.description.trim().length < 20) newErrors.description = "Please provide more detail (at least 20 characters)";
    if (!opp.whatChanges.trim()) newErrors.whatChanges = "Please describe what would change";
    if (!opp.howMany.trim()) {
      newErrors.howMany = "Please estimate the number of people affected";
    } else if (isNaN(Number(opp.howMany)) || Number(opp.howMany) < 0) {
      newErrors.howMany = "Please enter a valid number";
    }
    if (!opp.dataDescription.trim()) newErrors.dataDescription = "Please describe the available data";
    if (!opp.dataAccess.trim()) newErrors.dataAccess = "Please indicate data accessibility";

    setErrors((prev) => ({ ...prev, [activeIndex]: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateAll = (): boolean => {
    let allValid = true;
    const allErrors: typeof errors = {};

    opportunities.forEach((opportunity, index) => {
      const oppErrors: Partial<Record<keyof Opportunity, string>> = {};

      if (!opportunity.title.trim()) oppErrors.title = "Title is required";
      if (!opportunity.description.trim()) oppErrors.description = "Description is required";
      if (opportunity.description.trim().length < 20) oppErrors.description = "Please provide more detail";
      if (!opportunity.whatChanges.trim()) oppErrors.whatChanges = "Required";
      if (!opportunity.howMany.trim()) {
        oppErrors.howMany = "Required";
      } else if (isNaN(Number(opportunity.howMany)) || Number(opportunity.howMany) < 0) {
        oppErrors.howMany = "Please enter a valid number";
      }
      if (!opportunity.dataDescription.trim()) oppErrors.dataDescription = "Required";
      if (!opportunity.dataAccess.trim()) oppErrors.dataAccess = "Required";

      if (Object.keys(oppErrors).length > 0) {
        allValid = false;
        allErrors[index] = oppErrors;
      }
    });

    setErrors(allErrors);
    return allValid;
  };

  const handleNext = () => {
    if (validateAll()) {
      onNext();
    } else {
      // Find first opportunity with errors
      const firstErrorIndex = Object.keys(errors).map(Number).sort()[0] ?? activeIndex;
      setActiveIndex(firstErrorIndex);
    }
  };

  const handleAddOpportunity = () => {
    if (validateCurrent()) {
      addOpportunity();
      setActiveIndex(opportunities.length);
    }
  };

  const currentErrors = errors[activeIndex] || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">AI Opportunity Brief</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Describe a challenge or opportunity where AI might help. You can add up to 3 briefs.
        </p>
      </div>

      {/* Opportunity Tabs */}
      {opportunities.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {opportunities.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeIndex === index
                  ? "bg-[#1B2A4A] dark:bg-[#F90036] text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              } ${errors[index] ? "ring-2 ring-red-500" : ""}`}
            >
              Opportunity {index + 1}
            </button>
          ))}
        </div>
      )}

      {/* Opportunity Form */}
      <div className="space-y-6">
        {/* Title */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-[#E8913A]" />
            <h3 className="font-medium text-slate-900 dark:text-white">The Opportunity</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-slate-700 dark:text-slate-300">Opportunity Title *</Label>
              <Input
                id="title"
                value={opp.title}
                onChange={(e) => updateOpportunity(activeIndex, { title: e.target.value })}
                placeholder="e.g., Reducing wait times at health clinics"
                className={currentErrors.title ? "border-red-500" : ""}
              />
              {currentErrors.title && <p className="mt-1 text-sm text-red-500">{currentErrors.title}</p>}
            </div>

            <div>
              <Label htmlFor="description" className="text-slate-700 dark:text-slate-300">
                Describe the opportunity and who it affects *
              </Label>
              <Textarea
                id="description"
                value={opp.description}
                onChange={(e) => updateOpportunity(activeIndex, { description: e.target.value })}
                placeholder="What is the problem or opportunity? Who experiences it? What happens today?"
                rows={4}
                className={currentErrors.description ? "border-red-500" : ""}
              />
              {currentErrors.description && (
                <p className="mt-1 text-sm text-red-500">{currentErrors.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Impact */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-[#17A589]" />
            <h3 className="font-medium text-slate-900 dark:text-white">Expected Impact</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="whatChanges" className="text-slate-700 dark:text-slate-300">If this were addressed, what would change? *</Label>
              <Textarea
                id="whatChanges"
                value={opp.whatChanges}
                onChange={(e) => updateOpportunity(activeIndex, { whatChanges: e.target.value })}
                placeholder="Describe the ideal outcome if AI could help solve this"
                rows={3}
                className={currentErrors.whatChanges ? "border-red-500" : ""}
              />
              {currentErrors.whatChanges && (
                <p className="mt-1 text-sm text-red-500">{currentErrors.whatChanges}</p>
              )}
            </div>

            <div>
              <Label htmlFor="howMany" className="text-slate-700 dark:text-slate-300">Roughly how many people would be affected? *</Label>
              <Input
                id="howMany"
                type="number"
                min="0"
                value={opp.howMany}
                onChange={(e) => updateOpportunity(activeIndex, { howMany: e.target.value })}
                placeholder="e.g., 5000"
                className={currentErrors.howMany ? "border-red-500" : ""}
              />
              {currentErrors.howMany && (
                <p className="mt-1 text-sm text-red-500">{currentErrors.howMany}</p>
              )}
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-[#F90036]" />
            <h3 className="font-medium text-slate-900 dark:text-white">Data Availability</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="dataDescription" className="text-slate-700 dark:text-slate-300">What records and data exist related to this? *</Label>
              <Textarea
                id="dataDescription"
                value={opp.dataDescription}
                onChange={(e) => updateOpportunity(activeIndex, { dataDescription: e.target.value })}
                placeholder="Describe the data you have: spreadsheets, databases, paper records, etc."
                rows={3}
                className={currentErrors.dataDescription ? "border-red-500" : ""}
              />
              {currentErrors.dataDescription && (
                <p className="mt-1 text-sm text-red-500">{currentErrors.dataDescription}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dataAccess" className="text-slate-700 dark:text-slate-300">Can this data be shared with a project team? *</Label>
              <Input
                id="dataAccess"
                value={opp.dataAccess}
                onChange={(e) => updateOpportunity(activeIndex, { dataAccess: e.target.value })}
                placeholder="e.g., Yes with anonymisation, or No due to policy restrictions"
                className={currentErrors.dataAccess ? "border-red-500" : ""}
              />
              {currentErrors.dataAccess && (
                <p className="mt-1 text-sm text-red-500">{currentErrors.dataAccess}</p>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Contact (Optional) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h3 className="font-medium text-slate-900 dark:text-white mb-4">
            Secondary Contact (Optional)
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Add another person who can speak to this opportunity.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contact2Name" className="text-slate-700 dark:text-slate-300">Name</Label>
              <Input
                id="contact2Name"
                value={opp.secondaryContact?.name || ""}
                onChange={(e) =>
                  updateOpportunity(activeIndex, {
                    secondaryContact: { ...opp.secondaryContact, name: e.target.value },
                  })
                }
                placeholder="Contact person name"
              />
            </div>
            <div>
              <Label htmlFor="contact2Role" className="text-slate-700 dark:text-slate-300">Role</Label>
              <Input
                id="contact2Role"
                value={opp.secondaryContact?.role || ""}
                onChange={(e) =>
                  updateOpportunity(activeIndex, {
                    secondaryContact: { ...opp.secondaryContact, role: e.target.value },
                  })
                }
                placeholder="Their role or title"
              />
            </div>
            <div>
              <Label htmlFor="contact2Email" className="text-slate-700 dark:text-slate-300">Email</Label>
              <Input
                id="contact2Email"
                type="email"
                value={opp.secondaryContact?.email || ""}
                onChange={(e) =>
                  updateOpportunity(activeIndex, {
                    secondaryContact: { ...opp.secondaryContact, email: e.target.value },
                  })
                }
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="contact2Phone" className="text-slate-700 dark:text-slate-300">Phone</Label>
              <PhoneInput
                id="contact2Phone"
                value={opp.secondaryContact?.phone || ""}
                onChange={(phone) =>
                  updateOpportunity(activeIndex, {
                    secondaryContact: { ...opp.secondaryContact, phone },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add/Remove Opportunity */}
      <div className="flex items-center gap-4">
        {opportunities.length < 3 && (
          <Button variant="outline" onClick={handleAddOpportunity} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Another Opportunity
          </Button>
        )}
        {opportunities.length > 1 && (
          <Button
            variant="outline"
            onClick={() => {
              removeOpportunity(activeIndex);
              setActiveIndex(Math.max(0, activeIndex - 1));
            }}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            Remove This Opportunity
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90 dark:bg-[#F90036] dark:hover:bg-[#F90036]/90">
          Continue to Fit Questions
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
