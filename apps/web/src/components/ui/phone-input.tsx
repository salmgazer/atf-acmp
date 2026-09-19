"use client";

import * as React from "react";
import { CountrySelector, usePhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

export interface PhoneInputProps {
  value: string;
  onChange: (phone: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  id?: string;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, defaultCountry = "gh", placeholder = "Enter phone number", disabled, className, error, id }, ref) => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const phoneInput = usePhoneInput({
      defaultCountry,
      value,
      onChange: (data) => {
        onChange(data.phone);
      },
    });

    // Dynamic styles for dark/light mode
    const dropdownStyles: React.CSSProperties = {
      backgroundColor: isDark ? "#1A1C1E" : "#FFFFFF",
      borderColor: isDark ? "#2A2D30" : "#E2E8F0",
      borderRadius: "0.5rem",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    };

    const listItemStyles: React.CSSProperties = {
      backgroundColor: isDark ? "#1A1C1E" : "#FFFFFF",
      color: isDark ? "#F8FAFC" : "#1a1a2e",
    };

    return (
      <div
        className={cn(
          "flex h-11 w-full rounded-xl border bg-background shadow-sm ring-offset-background transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          error ? "border-red-500" : "border-input",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <CountrySelector
          selectedCountry={phoneInput.country.iso2}
          onSelect={(country) => phoneInput.setCountry(country.iso2)}
          disabled={disabled}
          dropdownStyleProps={{
            style: dropdownStyles,
            listItemStyle: listItemStyles,
            listItemCountryNameStyle: { color: isDark ? "#F8FAFC" : "#1a1a2e" },
            listItemDialCodeStyle: { color: isDark ? "#9CA3AF" : "#64748B" },
            listItemClassName: isDark ? "phone-dropdown-item-dark" : "",
          }}
          renderButtonWrapper={({ children, rootProps }) => (
            <button
              {...rootProps}
              type="button"
              className={cn(
                "flex items-center gap-1 px-3 border-r border-input bg-muted/50 rounded-l-xl h-full",
                "hover:bg-muted transition-colors",
                "focus:outline-none focus:bg-muted",
                disabled && "pointer-events-none"
              )}
            >
              {children}
            </button>
          )}
        />
        <input
          id={id}
          type="tel"
          ref={ref}
          placeholder={placeholder}
          disabled={disabled}
          value={phoneInput.inputValue}
          onChange={phoneInput.handlePhoneValueChange}
          className={cn(
            "flex-1 px-3 py-2 text-sm bg-transparent text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:cursor-not-allowed"
          )}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
