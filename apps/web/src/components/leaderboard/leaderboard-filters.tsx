"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface LeaderboardFiltersProps {
  verticals: Array<{ id: string; name: string }>;
  countries: string[];
  selectedVertical?: string;
  selectedCountry?: string;
  onVerticalChange: (value: string | undefined) => void;
  onCountryChange: (value: string | undefined) => void;
  onReset: () => void;
}

export function LeaderboardFilters({
  verticals,
  countries,
  selectedVertical,
  selectedCountry,
  onVerticalChange,
  onCountryChange,
  onReset,
}: LeaderboardFiltersProps) {
  const hasFilters = !!selectedVertical || !!selectedCountry;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={selectedVertical || "all"}
        onValueChange={(v) => onVerticalChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Verticals" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Verticals</SelectItem>
          {verticals.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedCountry || "all"}
        onValueChange={(v) => onCountryChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Countries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {countries.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="mr-1 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
