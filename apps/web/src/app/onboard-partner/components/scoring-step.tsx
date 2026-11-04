"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Opportunity,
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_OPTIONS,
  Q4_OPTIONS,
  Q5_OPTIONS,
  Q6_OPTIONS,
  Q7_OPTIONS,
  Q8_OPTIONS,
  ScoringAnswers,
} from "../types";
import { calculateScores } from "../scoring";
import { VerdictThermometer } from "./verdict-thermometer";

interface ScoringStepProps {
  opportunities: Opportunity[];
  updateOpportunity: (index: number, updates: Partial<Opportunity>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface QuestionConfig {
  id: keyof ScoringAnswers;
  question: string;
  helpText?: string;
  options: readonly { value: string; label: string }[];
}

const FIT_QUESTIONS: QuestionConfig[] = [
  {
    id: "q1",
    question: "What kind of work is this opportunity about?",
    helpText: "Think about how decisions are made today in this area.",
    options: Q1_OPTIONS,
  },
  {
    id: "q2",
    question: "What data exists related to this opportunity?",
    helpText: "AI solutions need data to learn from.",
    options: Q2_OPTIONS,
  },
  {
    id: "q3",
    question: "How clear are the rules or criteria for making decisions?",
    options: Q3_OPTIONS,
  },
  {
    id: "q4",
    question: "Do you know what 'good' looks like?",
    helpText: "Can you tell a good outcome from a bad one?",
    options: Q4_OPTIONS,
  },
  {
    id: "q5",
    question: "How clear is the desired outcome?",
    options: Q5_OPTIONS,
  },
  {
    id: "q6",
    question: "How often is this task performed?",
    options: Q6_OPTIONS,
  },
];

const IMPACT_QUESTIONS: QuestionConfig[] = [
  {
    id: "q7",
    question: "How deep would the impact be for each person affected?",
    helpText: "Think about how much it would change their experience.",
    options: Q7_OPTIONS,
  },
  {
    id: "q8",
    question: "How many people would be affected?",
    options: Q8_OPTIONS,
  },
];

export function ScoringStep({
  opportunities,
  updateOpportunity,
  onNext,
  onBack,
}: ScoringStepProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [activeIndex, setActiveIndex] = useState(0);
  const [errors, setErrors] = useState<Record<number, string[]>>({});

  const opp = opportunities[activeIndex];
  const answers = opp.scoringAnswers;

  // Calculate scores in real-time
  const scores = calculateScores(answers);
  const allQuestionsAnswered = 
    answers.q1 && answers.q2 && answers.q3 && 
    answers.q4 && answers.q5 && answers.q6 && 
    answers.q7 && answers.q8;

  const updateAnswer = (questionId: keyof ScoringAnswers, value: string, label: string) => {
    const textKey = `${questionId}_text` as keyof ScoringAnswers;
    updateOpportunity(activeIndex, {
      scoringAnswers: {
        ...answers,
        [questionId]: value,
        [textKey]: label,
      },
    });
  };

  const validateAll = (): boolean => {
    let allValid = true;
    const allErrors: typeof errors = {};

    opportunities.forEach((opportunity, index) => {
      const missingQuestions: string[] = [];
      const a = opportunity.scoringAnswers;

      if (!a.q1) missingQuestions.push("Q1");
      if (!a.q2) missingQuestions.push("Q2");
      if (!a.q3) missingQuestions.push("Q3");
      if (!a.q4) missingQuestions.push("Q4");
      if (!a.q5) missingQuestions.push("Q5");
      if (!a.q6) missingQuestions.push("Q6");
      if (!a.q7) missingQuestions.push("Q7");
      if (!a.q8) missingQuestions.push("Q8");

      if (missingQuestions.length > 0) {
        allValid = false;
        allErrors[index] = missingQuestions;
      }
    });

    setErrors(allErrors);
    return allValid;
  };

  const handleNext = () => {
    if (validateAll()) {
      onNext();
    } else {
      const firstErrorIndex = Object.keys(errors).map(Number).sort()[0] ?? activeIndex;
      setActiveIndex(firstErrorIndex);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">AI-Challenge Fit Assessment</h2>
        <p className="mt-1 text-muted-foreground">
          Answer these questions to see how well this opportunity fits the AI Challenge criteria.
        </p>
      </div>

      {/* Opportunity Tabs */}
      {opportunities.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {opportunities.map((o, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeIndex === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              } ${errors[index] ? "ring-2 ring-red-500" : ""}`}
            >
              {o.title || `Opportunity ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Current opportunity title */}
      <div className="rounded-lg bg-secondary p-4 border border-border">
        <p className="text-sm text-muted-foreground">Assessing:</p>
        <p className="font-medium text-foreground">{opp.title || "Untitled Opportunity"}</p>
      </div>

      {/* Verdict Thermometer - Shows real-time score */}
      {allQuestionsAnswered && (
        <VerdictThermometer
          fitScore={scores.fitScore}
          fitBand={scores.fitBand}
          impactScore={scores.impactScore}
          impactBand={scores.impactBand}
          scoreOverride={scores.scoreOverride}
        />
      )}

      {/* Fit Questions */}
      <div className="space-y-6">
        <h3 className="font-medium text-foreground border-b border-border pb-2">
          Fit Questions (determines AI-Challenge suitability)
        </h3>

        {FIT_QUESTIONS.map((q, index) => (
          <QuestionCard
            key={q.id}
            number={index + 1}
            question={q.question}
            helpText={q.helpText}
            options={q.options}
            value={answers[q.id] || ""}
            onChange={(value, label) => updateAnswer(q.id, value, label)}
            hasError={errors[activeIndex]?.includes(`Q${index + 1}`)}
            isDark={isDark}
          />
        ))}
      </div>

      {/* Impact Questions */}
      <div className="space-y-6">
        <h3 className="font-medium text-foreground border-b border-border pb-2">
          Impact Questions (measures potential reach)
        </h3>

        {IMPACT_QUESTIONS.map((q, index) => (
          <QuestionCard
            key={q.id}
            number={index + 7}
            question={q.question}
            helpText={q.helpText}
            options={q.options}
            value={answers[q.id] || ""}
            onChange={(value, label) => updateAnswer(q.id, value, label)}
            hasError={errors[activeIndex]?.includes(`Q${index + 7}`)}
            isDark={isDark}
          />
        ))}
      </div>

      {/* Error summary */}
      {errors[activeIndex] && errors[activeIndex].length > 0 && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">
            Please answer all questions. Missing: {errors[activeIndex].join(", ")}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} className="bg-primary hover:bg-primary/90">
          Review & Submit
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  number: number;
  question: string;
  helpText?: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string, label: string) => void;
  hasError?: boolean;
  isDark?: boolean;
}

function QuestionCard({
  number,
  question,
  helpText,
  options,
  value,
  onChange,
  hasError,
  isDark,
}: QuestionCardProps) {
  return (
    <div
      className={`rounded-xl border bg-card p-6 shadow-sm ${
        hasError ? "border-red-500" : "border-border"
      }`}
    >
      <div className="mb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs bg-primary text-primary-foreground">
            {number}
          </span>
          <div>
            <p className="font-medium text-foreground">{question}</p>
            {helpText && (
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                {helpText}
              </p>
            )}
          </div>
        </div>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(v) => {
          const option = options.find((o) => o.value === v);
          onChange(v, option?.label || "");
        }}
        className="space-y-2 ml-9"
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-3">
            <RadioGroupItem value={option.value} id={`${number}-${option.value}`} />
            <Label
              htmlFor={`${number}-${option.value}`}
              className="font-normal cursor-pointer text-foreground"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
