"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useMyMentorProfile,
  useUpdateMyMentorProfile,
  type UpdateMentorDto,
} from "@/lib/api/hooks/use-mentors";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signOut } from "@/lib/auth";
import {
  Mail,
  Phone,
  Link as LinkIcon,
  Linkedin,
  Calendar,
  Loader2,
  Save,
  Edit2,
  X,
  Plus,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

function ProfileContent() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [formData, setFormData] = useState<UpdateMentorDto>({});
  const [expertiseInput, setExpertiseInput] = useState("");

  const { data: profile, isLoading } = useMyMentorProfile();
  const updateMutation = useUpdateMyMentorProfile();

  useEffect(() => {
    if (profile) {
      setFormData({
        phone: profile.phone,
        bio: profile.bio,
        expertise: profile.expertise,
        calendlyLink: profile.calendlyLink,
        linkedinUrl: profile.linkedinUrl,
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(formData);
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      logout();
      router.push("/mentor/login");
    } catch (error) {
      toast.error("Failed to log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <MentorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MentorLayout>
    );
  }

  return (
    <MentorLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Your Profile</h1>
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xl font-bold">
              {profile?.firstName?.[0]}
              {profile?.lastName?.[0]}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {profile?.firstName} {profile?.lastName}
              </h2>
              {profile?.title && profile?.company && (
                <p className="text-muted-foreground">
                  {profile.title} at {profile.company}
                </p>
              )}
              <Badge
                variant={profile?.status === "active" ? "default" : "secondary"}
                className="mt-2"
              >
                {profile?.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold">Contact Information</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{profile?.email}</span>
              <Badge variant="outline" className="text-xs">
                Cannot change
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="Phone number"
                  className="max-w-xs"
                />
              ) : (
                <span className="text-sm">
                  {profile?.phone || "Not provided"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Bio</h3>
          {isEditing ? (
            <Textarea
              value={formData.bio || ""}
              onChange={(e) => setFormData((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell teams about yourself, your background, and how you can help..."
              rows={4}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {profile?.bio || "No bio provided"}
            </p>
          )}
        </div>

        {/* Expertise */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Areas of Expertise</h3>
          {isEditing && (
            <div className="flex gap-2">
              <Input
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                placeholder="Add expertise..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExpertise())}
              />
              <Button variant="outline" onClick={addExpertise}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {(isEditing ? formData.expertise : profile?.expertise)?.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className={isEditing ? "cursor-pointer" : ""}
                onClick={() => isEditing && removeExpertise(skill)}
              >
                {skill}
                {isEditing && " ×"}
              </Badge>
            ))}
            {((isEditing ? formData.expertise : profile?.expertise)?.length === 0) && (
              <span className="text-sm text-muted-foreground">
                No expertise listed
              </span>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold">Links</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Calendly Link</Label>
              </div>
              {isEditing ? (
                <Input
                  value={formData.calendlyLink || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, calendlyLink: e.target.value }))
                  }
                  placeholder="https://calendly.com/your-link"
                />
              ) : profile?.calendlyLink ? (
                <a
                  href={profile.calendlyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {profile.calendlyLink}
                  <LinkIcon className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">Not provided</span>
              )}
              <p className="text-xs text-muted-foreground">
                Teams will use this link to book sessions with you
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">LinkedIn Profile</Label>
              </div>
              {isEditing ? (
                <Input
                  value={formData.linkedinUrl || ""}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, linkedinUrl: e.target.value }))
                  }
                  placeholder="https://linkedin.com/in/your-profile"
                />
              ) : profile?.linkedinUrl ? (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {profile.linkedinUrl}
                  <LinkIcon className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">Not provided</span>
              )}
            </div>
          </div>
        </div>

        {/* Capacity Info (Read Only) */}
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Mentoring Capacity</h3>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Max Teams:</span>{" "}
              <span className="font-medium">{profile?.maxTeams}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Currently Assigned:</span>{" "}
              <span className="font-medium">
                {profile?.assignments?.filter((a) => a.isActive)?.length || 0}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Contact staff if you need to adjust your capacity
          </p>
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Log Out
        </Button>
      </div>
    </MentorLayout>
  );
}

export default function MentorProfilePage() {
  return (
    <ProtectedRoute portal="mentor">
      <ProfileContent />
    </ProtectedRoute>
  );
}
