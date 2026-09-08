"use client";

import { useState } from "react";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import {
  User,
  Mail,
  Shield,
  Key,
  Camera,
  Loader2,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

function ProfileContent() {
  const { user, updateUser } = useAuthStore();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.patch("/auth/profile", { firstName, lastName });
      updateUser({ firstName, lastName });
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed successfully");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleDisplay = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "program_manager":
        return "Program Manager";
      case "evaluator":
        return "Evaluator";
      case "viewer":
        return "Viewer";
      default:
        return "Staff";
    }
  };

  return (
    <StaffLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Profile Header */}
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-zinc-900 flex items-center justify-center text-white text-2xl font-semibold">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                </div>
                <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  {getRoleDisplay(user?.role)}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Personal Information</h3>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingProfile(false);
                      setFirstName(user?.firstName || "");
                      setLastName(user?.lastName || "");
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="text-sm font-medium text-foreground">
                      {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email Address</p>
                    <p className="text-sm font-medium text-foreground">{user?.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-6 border-b border-border/50">
            <h3 className="text-sm font-medium text-foreground">Security</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your password and security settings
            </p>
          </div>

          <div className="p-6">
            {isChangingPassword ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full h-10 px-3 pr-10 text-sm border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-10 px-3 pr-10 text-sm border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-10 px-3 pr-10 text-sm border border-border rounded-lg focus:outline-none focus:border-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">
                      Passwords do not match
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={isSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Update Password
                  </button>
                  <button
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground">
                      Last changed: Never
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-card"
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account Info Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-6 border-b border-border/50">
            <h3 className="text-sm font-medium text-foreground">Account Information</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Account ID</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your unique identifier</p>
              </div>
              <code className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                {user?.id?.slice(0, 8)}...
              </code>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">Role</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your access level</p>
              </div>
              <span className="text-sm text-muted-foreground">{getRoleDisplay(user?.role)}</span>
            </div>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute portal="staff">
      <ProfileContent />
    </ProtectedRoute>
  );
}
