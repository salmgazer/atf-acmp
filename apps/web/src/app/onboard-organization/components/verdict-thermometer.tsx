"use client";

import { cn } from "@/lib/utils";
import { getFitBandLabel, getImpactBandLabel, getFitBandColor } from "../scoring";
import { CheckCircle2, AlertTriangle, XCircle, Zap } from "lucide-react";

interface VerdictThermometerProps {
  fitScore: number;
  fitBand: string;
  impactScore: number | null;
  impactBand: string | null;
  scoreOverride: string | null;
}

export function VerdictThermometer({
  fitScore,
  fitBand,
  impactScore,
  impactBand,
  scoreOverride,
}: VerdictThermometerProps) {
  const colors = getFitBandColor(fitBand);
  const isOverride = scoreOverride !== null;
  
  // Determine icon based on fit band
  const FitIcon = fitBand === "strong_fit" 
    ? CheckCircle2 
    : fitBand === "promising" 
    ? AlertTriangle 
    : isOverride
    ? AlertTriangle
    : XCircle;

  const fitIconColor = fitBand === "strong_fit"
    ? "text-emerald-500"
    : fitBand === "promising"
    ? "text-amber-500"
    : isOverride
    ? "text-orange-500"
    : "text-slate-400 dark:text-slate-500";

  return (
    <div className={cn("rounded-xl border p-6 dark:bg-slate-800", colors.border, colors.bg, "dark:border-slate-700")}>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Fit Score Section */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <FitIcon className={cn("h-5 w-5", fitIconColor)} />
            <h4 className="font-medium text-slate-700 dark:text-slate-200">AI-Challenge Fit</h4>
          </div>
          
          {/* Score Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  fitBand === "strong_fit" && "bg-emerald-500",
                  fitBand === "promising" && "bg-amber-500",
                  fitBand === "different_solution" && "bg-slate-400 dark:bg-slate-500",
                  isOverride && "bg-orange-500"
                )}
                style={{ width: `${Math.min(100, fitScore)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-2xl font-bold text-slate-800 dark:text-white">{fitScore}</span>
              <span className={cn("text-sm font-medium px-3 py-1 rounded-full", colors.text, colors.bg)}>
                {getFitBandLabel(fitBand)}
              </span>
            </div>
          </div>

          {/* Override Message */}
          {scoreOverride && (
            <div className="mt-3 p-3 rounded-lg bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">{scoreOverride}</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                This opportunity may need some groundwork before it&apos;s ready for an AI solution.
              </p>
            </div>
          )}
        </div>

        {/* Impact Score Section */}
        {impactScore !== null && impactBand && (
          <div className="flex-1 sm:border-l sm:pl-6 border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-purple-500" />
              <h4 className="font-medium text-slate-700 dark:text-slate-200">Potential Impact</h4>
            </div>

            {/* Impact Grid */}
            <div className="grid grid-cols-3 gap-1 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <div
                  key={n}
                  className={cn(
                    "h-8 rounded flex items-center justify-center text-xs font-medium transition-all",
                    n <= impactScore
                      ? n >= 7
                        ? "bg-purple-500 text-white"
                        : n >= 4
                        ? "bg-purple-300 dark:bg-purple-400 text-purple-900 dark:text-purple-950"
                        : "bg-purple-200 dark:bg-purple-300 text-purple-800 dark:text-purple-900"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                  )}
                >
                  {n}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-slate-800 dark:text-white">{impactScore}</span>
              <span
                className={cn(
                  "text-sm font-medium px-3 py-1 rounded-full",
                  impactBand === "high_impact" && "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
                  impactBand === "moderate_impact" && "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
                  impactBand === "lower_impact" && "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {getImpactBandLabel(impactBand)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Interpretation Guide */}
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <strong className="text-slate-600 dark:text-slate-300">How to read this:</strong> A score of 70+ indicates strong AI-Challenge fit. 
          Scores 45-69 are promising but may need groundwork. 
          Impact combines depth (how meaningful) × breadth (how many people).
        </p>
      </div>
    </div>
  );
}
