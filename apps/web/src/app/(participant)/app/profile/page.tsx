"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTheme } from "next-themes";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCurrentParticipant,
  useUpdateParticipant,
  useParticipantPreferences,
  useUploadMyProfilePicture,
} from "@/lib/api/hooks/use-participants";
import { useMyTeam } from "@/lib/api/hooks/use-teams";
import { useApprovedBriefs } from "@/lib/api/hooks/use-briefs";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signOut, changePassword } from "@/lib/auth";
import {
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  Sparkles,
  Settings,
  LogOut,
  Loader2,
  Pencil,
  Shield,
  Bell,
  HelpCircle,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Trophy,
  FileText,
  Sun,
  Moon,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Skills options
const SKILL_OPTIONS = [
  "Python",
  "JavaScript/TypeScript",
  "Machine Learning",
  "Data Science",
  "Mobile Development",
  "UI/UX Design",
  "Project Management",
  "Business Strategy",
  "Research",
  "Content Writing",
  "Marketing",
  "Public Speaking",
];

const INTEREST_OPTIONS = [
  "Artificial Intelligence",
  "Climate & Sustainability",
  "Healthcare & Medicine",
  "Education",
  "FinTech",
  "Agriculture",
  "E-commerce",
  "Social Impact",
  "Entertainment",
  "Transportation",
];

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  institution: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

function ProfileContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSkillsDialog, setShowSkillsDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: participant, isLoading } = useCurrentParticipant();
  const { data: team } = useMyTeam(participant?.id || "");
  const { data: preferences, isLoading: preferencesLoading } = useParticipantPreferences(participant?.id || "");
  const { data: briefs, isLoading: briefsLoading } = useApprovedBriefs(participant?.cohortId || "");
  const updateMutation = useUpdateParticipant();
  const uploadPictureMutation = useUploadMyProfilePicture();

  // Check if team has a brief assigned
  const hasBrief = !!team?.briefId;

  // Get ranked briefs with their details
  const briefRankingIds = preferences?.briefRankings || [];
  const rankedBriefs = briefRankingIds
    .slice(0, 5)
    .map((briefId) => briefs?.find((b) => b.id === briefId))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: participant ? {
      firstName: participant.firstName || "",
      lastName: participant.lastName || "",
      institution: participant.institution || "",
      phoneNumber: participant.phoneNumber || "",
    } : undefined,
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const handleEditProfile = async (data: ProfileFormData) => {
    if (!participant) return;

    try {
      await updateMutation.mutateAsync({
        id: participant.id,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          institution: data.institution,
          phoneNumber: data.phoneNumber,
        },
      });
      toast.success("Profile updated successfully");
      setShowEditDialog(false);
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const handleUpdateSkills = async () => {
    if (!participant) return;

    try {
      await updateMutation.mutateAsync({
        id: participant.id,
        data: {
          skills: selectedSkills,
          interests: selectedInterests,
        },
      });
      toast.success("Skills updated successfully");
      setShowSkillsDialog(false);
    } catch (error) {
      toast.error("Failed to update skills");
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // Clear all cached queries to prevent stale data on next login
      queryClient.clear();
      logout();
      router.push("/app/login");
    } catch (error) {
      toast.error("Failed to log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const openSkillsDialog = () => {
    setSelectedSkills(participant?.skills || []);
    setSelectedInterests(participant?.interests || []);
    setShowSkillsDialog(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    try {
      await uploadPictureMutation.mutateAsync(file);
      toast.success("Profile picture updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload profile picture");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChangePassword = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      toast.success("Password changed successfully");
      setShowPasswordDialog(false);
      passwordForm.reset();
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to change password";
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Unable to load profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="relative group">
              {participant.profileImageUrl ? (
                <img
                  src={participant.profileImageUrl}
                  alt={`${participant.firstName} ${participant.lastName}`}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">
                    {participant.firstName?.[0]}{participant.lastName?.[0]}
                  </span>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPictureMutation.isPending}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadPictureMutation.isPending ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                {participant.firstName} {participant.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{participant.email}</p>
              <Badge variant="secondary" className="mt-2">
                {participant.participantId}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{participant.email}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">
                  {participant.phoneNumber || "Not provided"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Institution</p>
                <p className="text-sm text-muted-foreground">
                  {participant.institution || "Not provided"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Country</p>
                <p className="text-sm text-muted-foreground">{participant.country}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills & Interests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Skills & Interests
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={openSkillsDialog}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {participant.skills && participant.skills.length > 0 ? (
                participant.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No skills added yet</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {participant.interests && participant.interests.length > 0 ? (
                participant.interests.map((interest) => (
                  <Badge key={interest} variant="outline">
                    {interest}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No interests added yet</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brief Rankings - show rankings if any exist */}
      {briefRankingIds.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Brief Rankings
            </CardTitle>
            {!hasBrief && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/briefs/rank">
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {briefsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rankedBriefs.length > 0 ? (
              <div className="space-y-2">
                {rankedBriefs.map((brief, index) => (
                  <div
                    key={brief.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        index === 0
                          ? "bg-yellow-500 text-white"
                          : index === 1
                          ? "bg-gray-400 text-white"
                          : index === 2
                          ? "bg-amber-600 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{brief.title}</p>
                      {brief.organization?.name && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {brief.organization.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {briefRankingIds.length} brief{briefRankingIds.length !== 1 ? 's' : ''} ranked
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show prompt to rank briefs if no rankings and team doesn't have brief */}
      {rankedBriefs.length === 0 && !hasBrief && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Brief Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No briefs ranked yet</p>
              <Button variant="link" size="sm" asChild className="mt-1">
                <Link href="/app/briefs/rank">Rank your preferred briefs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <button
            className="flex items-center justify-between w-full py-3 px-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Appearance</span>
            </div>
            <span className="text-sm text-muted-foreground capitalize">
              {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>

          <button
            className="flex items-center justify-between w-full py-3 px-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => router.push("/app/notifications")}
          >
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Notifications</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            className="flex items-center justify-between w-full py-3 px-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setShowPasswordDialog(true)}
          >
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Change Password</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            className="flex items-center justify-between w-full py-3 px-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => router.push("/app/help")}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Help & Support</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Logout Button */}
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

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleEditProfile)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Input
                id="institution"
                placeholder="e.g. University of Nairobi"
                {...form.register("institution")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+254 700 000 000"
                {...form.register("phoneNumber")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Skills Dialog */}
      <Dialog open={showSkillsDialog} onOpenChange={setShowSkillsDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Skills & Interests</DialogTitle>
            <DialogDescription>
              Update your skills and interests to help with team matching
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label className="text-base">Skills</Label>
              <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => (
                  <Badge
                    key={skill}
                    variant={selectedSkills.includes(skill) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedSkills((prev) =>
                        prev.includes(skill)
                          ? prev.filter((s) => s !== skill)
                          : [...prev, skill]
                      );
                    }}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base">Interests</Label>
              <p className="text-xs text-muted-foreground mb-3">What domains excite you?</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <Badge
                    key={interest}
                    variant={selectedInterests.includes(interest) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedInterests((prev) =>
                        prev.includes(interest)
                          ? prev.filter((i) => i !== interest)
                          : [...prev, interest]
                      );
                    }}
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSkillsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSkills}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Change Password</DialogTitle>
            <DialogDescription className="text-center">
              Enter your current password and choose a new password
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  {...passwordForm.register("currentPassword")}
                  disabled={isChangingPassword}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                For first-time login, your current password is your Participant ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  {...passwordForm.register("newPassword")}
                  disabled={isChangingPassword}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  {...passwordForm.register("confirmPassword")}
                  disabled={isChangingPassword}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  passwordForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Change Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute portal="participant">
      <ParticipantLayout>
        <ProfileContent />
      </ParticipantLayout>
    </ProtectedRoute>
  );
}
