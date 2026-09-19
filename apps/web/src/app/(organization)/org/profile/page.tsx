"use client";

import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { OrganizationLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  useCurrentOrganization,
  useUpdateOrganization,
  useUploadOrganizationLogo,
} from "@/lib/api/hooks/use-organizations";
import {
  Building2,
  Upload,
  Loader2,
  Camera,
  Globe,
  Mail,
  Phone,
  MapPin,
  User,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

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

const profileSchema = z.object({
  name: z.string().min(2, "Organization name is required").max(200),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().max(2000).optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().max(200).optional(),
  contactPhone: z.string().max(50).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const statusConfig = {
  pending: { label: "Pending Approval", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "Approved", icon: CheckCircle, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

function ProfileContent() {
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateMutation = useUpdateOrganization();
  const uploadLogoMutation = useUploadOrganizationLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: organization
      ? {
          name: organization.name,
          website: organization.website || "",
          description: organization.description || "",
          industry: organization.industry || "",
          country: organization.country || "",
          contactPerson: organization.contactPerson || "",
          contactPhone: organization.contactPhone || "",
        }
      : undefined,
  });

  const selectedCountry = watch("country");

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      await uploadLogoMutation.mutateAsync({
        id: organization.id,
        file,
      });
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!organization) return;

    await updateMutation.mutateAsync({
      id: organization.id,
      data: {
        ...data,
        website: data.website || undefined,
      },
    });
    reset(data);
  };

  if (isLoading) {
    return (
      <OrganizationLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OrganizationLayout>
    );
  }

  if (!organization) {
    return (
      <OrganizationLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Organization not found</p>
        </div>
      </OrganizationLayout>
    );
  }

  const status = statusConfig[organization.status];
  const StatusIcon = status.icon;

  return (
    <OrganizationLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Profile</h1>
          <p className="text-muted-foreground">
            Manage your organization's information and settings.
          </p>
        </div>

        {/* Status Banner */}
        <div className={`rounded-lg p-4 ${status.color}`}>
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            <span className="font-medium">Status: {status.label}</span>
          </div>
          {organization.status === "rejected" && organization.rejectionReason && (
            <p className="mt-2 text-sm">Reason: {organization.rejectionReason}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Logo Section */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-4">Organization Logo</h2>
              <div className="flex flex-col items-center">
                <div
                  className="relative w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden group"
                  onClick={handleLogoClick}
                >
                  {organization.logoUrl ? (
                    <>
                      <img
                        src={organization.logoUrl}
                        alt={organization.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-xs text-muted-foreground">Click to upload</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Recommended: 200x200px, PNG or JPG, max 5MB
                </p>
              </div>

              <Separator className="my-6" />

              {/* Quick Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{organization.email}</span>
                </div>
                {organization.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {organization.website}
                    </a>
                  </div>
                )}
                {organization.country && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{organization.country}</span>
                  </div>
                )}
                {organization.contactPerson && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{organization.contactPerson}</span>
                  </div>
                )}
                {organization.contactPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{organization.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold mb-6">Organization Details</h2>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Organization Name *</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <select
                      id="industry"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...register("industry")}
                    >
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <select
                      id="country"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...register("country")}
                    >
                      <option value="">Select country</option>
                      {AFRICAN_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="website">Website</Label>
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
                    <Label htmlFor="description">About</Label>
                    <Textarea
                      id="description"
                      rows={4}
                      placeholder="Tell us about your organization..."
                      {...register("description")}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">{errors.description.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <h3 className="font-medium">Contact Information</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      placeholder="Full name"
                      {...register("contactPerson")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone Number</Label>
                    <Controller
                      name="contactPhone"
                      control={control}
                      render={({ field }) => (
                        <PhoneInput
                          id="contactPhone"
                          value={field.value || ""}
                          onChange={field.onChange}
                          defaultCountry={getCountryCode(selectedCountry || "")}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset()}
                    disabled={!isDirty}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isDirty || updateMutation.isPending}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  );
}

export default function OrganizationProfilePage() {
  return (
    <ProtectedRoute portal="organization">
      <ProfileContent />
    </ProtectedRoute>
  );
}
