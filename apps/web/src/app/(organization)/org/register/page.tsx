"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { useRegisterOrganization } from "@/lib/api/hooks/use-organizations";

const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "Agriculture",
  "Education",
  "Energy & Utilities",
  "Retail & E-commerce",
  "Manufacturing",
  "Transportation & Logistics",
  "Telecommunications",
  "Media & Entertainment",
  "Real Estate",
  "Government & Public Sector",
  "Non-profit & NGO",
  "Other",
];

const AFRICAN_COUNTRIES = [
  "Nigeria",
  "Kenya",
  "South Africa",
  "Ghana",
  "Egypt",
  "Rwanda",
  "Ethiopia",
  "Tanzania",
  "Uganda",
  "Morocco",
  "Senegal",
  "Cameroon",
  "Cote d'Ivoire",
  "Zimbabwe",
  "Zambia",
  "Botswana",
  "Mauritius",
  "Tunisia",
  "Algeria",
  "Namibia",
];

// Map country names to ISO codes for phone input
const COUNTRY_CODE_MAP: Record<string, string> = {
  Nigeria: "ng",
  Kenya: "ke",
  "South Africa": "za",
  Ghana: "gh",
  Egypt: "eg",
  Rwanda: "rw",
  Ethiopia: "et",
  Tanzania: "tz",
  Uganda: "ug",
  Morocco: "ma",
  Senegal: "sn",
  Cameroon: "cm",
  "Cote d'Ivoire": "ci",
  Zimbabwe: "zw",
  Zambia: "zm",
  Botswana: "bw",
  Mauritius: "mu",
  Tunisia: "tn",
  Algeria: "dz",
  Namibia: "na",
};

const getCountryCode = (country: string): string => COUNTRY_CODE_MAP[country] || "gh";

const registerSchema = z.object({
  name: z.string().min(2, "Organization name is required").max(200),
  email: z.string().email("Please enter a valid email"),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().min(50, "Please provide at least 50 characters").max(2000),
  industry: z.string().min(1, "Please select an industry"),
  country: z.string().min(1, "Please select a country"),
  contactPerson: z.string().min(2, "Contact person name is required").max(200),
  contactPhone: z.string().min(6, "Please enter a valid phone number").max(50),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function OrganizationRegisterPage() {
  const router = useRouter();
  const registerMutation = useRegisterOrganization();
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      website: "",
      description: "",
      industry: "",
      country: "",
      contactPerson: "",
      contactPhone: "",
    },
  });

  const selectedCountry = watch("country");

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerMutation.mutateAsync({
        ...data,
        website: data.website || undefined,
      });
      setIsSuccess(true);
    } catch (error) {
      // Error is handled by mutation
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Registration Submitted!</h1>
            <p className="text-muted-foreground">
              Thank you for registering. Our team will review your application and
              get back to you within 2-3 business days.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You'll receive a confirmation email with further instructions.
            </p>
            <Button asChild variant="outline">
              <Link href="/org/login">Go to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-xl space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Register Your Organization</h1>
            </div>
            <p className="text-muted-foreground">
              Join the AI Challenge and submit innovation briefs for talented teams to solve.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Organization Info */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Organization Details</h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Organization Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter organization name"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry *</Label>
                  <select
                    id="industry"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register("industry")}
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                  {errors.industry && (
                    <p className="text-sm text-destructive">{errors.industry.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <select
                    id="country"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register("country")}
                  >
                    <option value="">Select country</option>
                    {AFRICAN_COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.country && (
                    <p className="text-sm text-destructive">{errors.country.message}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://example.com"
                    {...register("website")}
                  />
                  {errors.website && (
                    <p className="text-sm text-destructive">{errors.website.message}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">About Your Organization *</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="Tell us about your organization, its mission, and why you want to participate in the AI Challenge..."
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Contact Information</h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person *</Label>
                  <Input
                    id="contactPerson"
                    placeholder="Full name"
                    {...register("contactPerson")}
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-destructive">{errors.contactPerson.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone Number *</Label>
                  <Controller
                    name="contactPhone"
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        id="contactPhone"
                        value={field.value}
                        onChange={field.onChange}
                        defaultCountry={getCountryCode(selectedCountry)}
                        error={!!errors.contactPhone}
                      />
                    )}
                  />
                  {errors.contactPhone && (
                    <p className="text-sm text-destructive">{errors.contactPhone.message}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@organization.com"
                    {...register("email")}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be used for login and all communications
                  </p>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Link
                href="/org/login"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Already registered? Sign in
              </Link>
              <Button type="submit" disabled={isSubmitting || registerMutation.isPending}>
                {(isSubmitting || registerMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Registration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Right side - Info */}
      <div className="hidden lg:flex lg:flex-1 bg-primary text-primary-foreground p-12 items-center justify-center">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Partner with Africa's Future Innovators</h2>
            <p className="text-primary-foreground/80">
              Submit real-world challenges from your organization and watch talented teams 
              develop innovative AI solutions.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold">Register & Get Approved</h3>
                <p className="text-sm text-primary-foreground/70">
                  Submit your organization details for review
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold">Submit Innovation Briefs</h3>
                <p className="text-sm text-primary-foreground/70">
                  Define challenges you want teams to solve
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold">Review Solutions</h3>
                <p className="text-sm text-primary-foreground/70">
                  Track progress and evaluate team submissions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
