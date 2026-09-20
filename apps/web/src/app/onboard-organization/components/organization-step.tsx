"use client";

import { useState } from "react";
import { ArrowRight, Building2, User, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrganizationInfo, VALID_COUNTRIES, SECTORS } from "../types";

// Map countries to ISO codes for phone input
const COUNTRY_TO_ISO: Record<string, string> = {
  Ghana: "gh",
  Nigeria: "ng",
  Kenya: "ke",
  "South Africa": "za",
};

interface OrganizationStepProps {
  org: OrganizationInfo;
  updateOrg: (updates: Partial<OrganizationInfo>) => void;
  onNext: () => void;
}

export function OrganizationStep({ org, updateOrg, onNext }: OrganizationStepProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationInfo, string>>>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!org.orgName.trim()) newErrors.orgName = "Organisation name is required";
    if (!org.sector) newErrors.sector = "Sector is required";
    if (org.sector === "Other" && !org.sectorOther?.trim()) {
      newErrors.sectorOther = "Please specify your sector";
    }
    if (!org.country) newErrors.country = "Country is required";
    if (!org.city.trim()) newErrors.city = "City is required";
    if (!org.contactName.trim()) newErrors.contactName = "Your name is required";
    if (!org.designation.trim()) newErrors.designation = "Designation is required";
    if (!org.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(org.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!org.phone.trim()) newErrors.phone = "Phone number is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Organisation Details</h2>
        <p className="mt-1 text-muted-foreground">
          Tell us about your organisation and who is filling out this form.
        </p>
      </div>

      {/* Organisation Info Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-5 w-5 text-[#17A589]" />
          <h3 className="font-medium text-foreground">Organisation Information</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Organisation Name */}
          <div className="sm:col-span-2">
            <Label htmlFor="orgName" className="text-foreground">Organisation Name *</Label>
            <Input
              id="orgName"
              value={org.orgName}
              onChange={(e) => updateOrg({ orgName: e.target.value })}
              placeholder="e.g., Ministry of Health"
              className={errors.orgName ? "border-red-500" : ""}
            />
            {errors.orgName && <p className="mt-1 text-sm text-red-500">{errors.orgName}</p>}
          </div>

          {/* Sector */}
          <div>
            <Label htmlFor="sector" className="text-foreground">Sector *</Label>
            <Select value={org.sector} onValueChange={(value) => updateOrg({ sector: value })}>
              <SelectTrigger className={errors.sector ? "border-red-500" : ""}>
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.sector && <p className="mt-1 text-sm text-red-500">{errors.sector}</p>}
          </div>

          {/* Sector Other */}
          {org.sector === "Other" && (
            <div>
              <Label htmlFor="sectorOther" className="text-foreground">Please specify *</Label>
              <Input
                id="sectorOther"
                value={org.sectorOther || ""}
                onChange={(e) => updateOrg({ sectorOther: e.target.value })}
                placeholder="Your sector"
                className={errors.sectorOther ? "border-red-500" : ""}
              />
              {errors.sectorOther && <p className="mt-1 text-sm text-red-500">{errors.sectorOther}</p>}
            </div>
          )}

          {/* Country */}
          <div>
            <Label htmlFor="country" className="text-foreground">Country *</Label>
            <Select
              value={org.country}
              onValueChange={(value) => updateOrg({ country: value as OrganizationInfo["country"] })}
            >
              <SelectTrigger className={errors.country ? "border-red-500" : ""}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {VALID_COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && <p className="mt-1 text-sm text-red-500">{errors.country}</p>}
          </div>

          {/* City */}
          <div>
            <Label htmlFor="city" className="text-foreground">City or Town *</Label>
            <Input
              id="city"
              value={org.city}
              onChange={(e) => updateOrg({ city: e.target.value })}
              placeholder="e.g., Accra"
              className={errors.city ? "border-red-500" : ""}
            />
            {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
          </div>
        </div>
      </div>

      {/* Contact Info Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="h-5 w-5 text-[#17A589]" />
          <h3 className="font-medium text-foreground">Your Contact Details</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Contact Name */}
          <div>
            <Label htmlFor="contactName" className="text-foreground">Your Name *</Label>
            <Input
              id="contactName"
              value={org.contactName}
              onChange={(e) => updateOrg({ contactName: e.target.value })}
              placeholder="Full name"
              className={errors.contactName ? "border-red-500" : ""}
            />
            {errors.contactName && <p className="mt-1 text-sm text-red-500">{errors.contactName}</p>}
          </div>

          {/* Designation */}
          <div>
            <Label htmlFor="designation" className="text-foreground">Designation/Title *</Label>
            <Input
              id="designation"
              value={org.designation}
              onChange={(e) => updateOrg({ designation: e.target.value })}
              placeholder="e.g., Director of IT"
              className={errors.designation ? "border-red-500" : ""}
            />
            {errors.designation && <p className="mt-1 text-sm text-red-500">{errors.designation}</p>}
          </div>

          {/* Department */}
          <div>
            <Label htmlFor="department" className="text-foreground">Department (optional)</Label>
            <Input
              id="department"
              value={org.department || ""}
              onChange={(e) => updateOrg({ department: e.target.value })}
              placeholder="e.g., Information Technology"
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-foreground">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={org.email}
                onChange={(e) => updateOrg({ email: e.target.value })}
                placeholder="you@organisation.org"
                className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
              />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone" className="text-foreground">Phone Number *</Label>
            <PhoneInput
              id="phone"
              value={org.phone}
              onChange={(phone) => updateOrg({ phone })}
              defaultCountry={org.country ? COUNTRY_TO_ISO[org.country] : "gh"}
              error={!!errors.phone}
            />
            {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          className="bg-primary hover:bg-primary/90"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
