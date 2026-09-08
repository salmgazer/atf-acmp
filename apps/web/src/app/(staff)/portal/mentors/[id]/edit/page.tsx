"use client";

import { use, useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMentor,
  useUpdateMentor,
  useUploadMentorProfilePicture,
  type UpdateMentorDto,
  type MentorStatus,
} from "@/lib/api/hooks/use-mentors";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Upload,
  User,
  Save,
} from "lucide-react";
import { toast } from "sonner";

function EditMentorContent({ id }: { id: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expertiseInput, setExpertiseInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateMentorDto>({});
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: mentor, isLoading, error } = useMentor(id);
  const { data: verticalsData } = useVerticals(mentor?.cohortId);
  const verticals = verticalsData || [];

  const updateMutation = useUpdateMentor();
  const uploadMutation = useUploadMentorProfilePicture();

  // Initialize form data when mentor loads
  useEffect(() => {
    if (mentor && !isInitialized) {
      setFormData({
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        phone: mentor.phone || "",
        company: mentor.company || "",
        title: mentor.title || "",
        bio: mentor.bio || "",
        profileImageUrl: mentor.profileImageUrl || "",
        expertise: mentor.expertise || [],
        calendlyLink: mentor.calendlyLink || "",
        linkedinUrl: mentor.linkedinUrl || "",
        maxTeams: mentor.maxTeams,
        verticalScope: mentor.verticalScope || [],
        status: mentor.status,
      });
      if (mentor.profileImageUrl) {
        setImagePreview(mentor.profileImageUrl);
      }
      setIsInitialized(true);
    }
  }, [mentor, isInitialized]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      const result = await uploadMutation.mutateAsync({ mentorId: id, file });
      setFormData((f) => ({ ...f, profileImageUrl: result.profileImageUrl }));
      toast.success("Profile picture uploaded");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
      // Revert preview to original
      setImagePreview(mentor?.profileImageUrl || null);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData((f) => ({ ...f, profileImageUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName) {
      toast.error("First name and last name are required");
      return;
    }

    try {
      await updateMutation.mutateAsync({ id, dto: formData });
      toast.success("Mentor updated successfully");
      router.push(`/portal/mentors/${id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update mentor");
    }
  };

  const addExpertise = () => {
    if (expertiseInput.trim() && !formData.expertise?.includes(expertiseInput.trim())) {
      setFormData((f) => ({
        ...f,
        expertise: [...(f.expertise || []), expertiseInput.trim()],
      }));
      setExpertiseInput("");
    }
  };

  const removeExpertise = (skill: string) => {
    setFormData((f) => ({
      ...f,
      expertise: f.expertise?.filter((e) => e !== skill),
    }));
  };

  const toggleVertical = (verticalId: string) => {
    setFormData((f) => {
      const current = f.verticalScope || [];
      if (current.includes(verticalId)) {
        return { ...f, verticalScope: current.filter((v) => v !== verticalId) };
      }
      return { ...f, verticalScope: [...current, verticalId] };
    });
  };

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (error || !mentor) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Mentor not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/mentors">Back to Mentors</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/portal/mentors/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Mentor</h1>
            <p className="text-muted-foreground">
              Update {mentor.firstName} {mentor.lastName}&apos;s profile
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                {imagePreview ? (
                  <div className="relative h-24 w-24 rounded-full overflow-hidden bg-muted">
                    <Image
                      src={imagePreview}
                      alt="Profile preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="profile-picture-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {imagePreview ? "Change Photo" : "Upload Photo"}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  JPEG, PNG or WebP. Max 10MB. Will be resized to 400x400px.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">Basic Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.firstName || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, firstName: e.target.value }))
                  }
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.lastName || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, lastName: e.target.value }))
                  }
                  placeholder="Doe"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email</Label>
                <Input value={mentor.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Teams</Label>
                <Select
                  value={String(formData.maxTeams || 3)}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, maxTeams: parseInt(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} team{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || "active"}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, status: v as MentorStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Professional Info */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">Professional Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company/Organization</Label>
                <Input
                  value={formData.company || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, company: e.target.value }))
                  }
                  placeholder="TechCorp Inc."
                />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Senior Engineer"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bio</Label>
                <Textarea
                  value={formData.bio || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Brief introduction about the mentor..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Expertise */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">Areas of Expertise</h2>
            <div className="flex gap-2">
              <Input
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                placeholder="Add expertise (e.g., Machine Learning)"
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addExpertise())
                }
              />
              <Button type="button" variant="outline" onClick={addExpertise}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.expertise && formData.expertise.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.expertise.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="cursor-pointer pr-1"
                    onClick={() => removeExpertise(skill)}
                  >
                    {skill}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Vertical Scope */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-2">Vertical Scope (Optional)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Leave empty to allow mentoring in any vertical, or select specific
              verticals to limit scope.
            </p>
            {verticals.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No verticals found for this cohort.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {verticals.map((vertical) => {
                  const isSelected = formData.verticalScope?.includes(vertical.id);
                  return (
                    <Badge
                      key={vertical.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleVertical(vertical.id)}
                    >
                      {vertical.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Links */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold mb-4">Links</h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Calendly Link</Label>
                <Input
                  value={formData.calendlyLink || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, calendlyLink: e.target.value }))
                  }
                  placeholder="https://calendly.com/your-link"
                />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn URL</Label>
                <Input
                  value={formData.linkedinUrl || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, linkedinUrl: e.target.value }))
                  }
                  placeholder="https://linkedin.com/in/your-profile"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button asChild variant="outline">
              <Link href={`/portal/mentors/${id}`}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || uploadMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </StaffLayout>
  );
}

export default function EditMentorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="staff">
      <EditMentorContent id={id} />
    </ProtectedRoute>
  );
}
