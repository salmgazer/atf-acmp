"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStaff,
  useStaffStatistics,
  useCreateStaff,
  useUpdateStaff,
  useActivateStaff,
  useDeactivateStaff,
  useResendStaffInvite,
  type Staff,
  type StaffRole,
  type CreateStaffDto,
  type UpdateStaffDto,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_COLORS,
} from "@/lib/api/hooks/use-staff";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  Search,
  Users,
  UserPlus,
  MoreHorizontal,
  Pencil,
  UserX,
  UserCheck,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  Mail,
  Send,
} from "lucide-react";
import { format } from "date-fns";

const STAFF_ROLES: StaffRole[] = ["super_admin", "program_manager", "evaluator", "viewer"];

const createStaffSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["super_admin", "program_manager", "evaluator", "viewer"]),
});

const updateStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["super_admin", "program_manager", "evaluator", "viewer"]),
});

type CreateStaffForm = z.infer<typeof createStaffSchema>;
type UpdateStaffForm = z.infer<typeof updateStaffSchema>;

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAFF_ROLE_COLORS[role]}`}>
      {STAFF_ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <CheckCircle className="h-3 w-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="h-3 w-3" />
      Inactive
    </span>
  );
}

function StaffRow({
  staff,
  isSuperAdmin,
  currentUserId,
  onEdit,
  onActivate,
  onDeactivate,
  onResendInvite,
}: {
  staff: Staff;
  isSuperAdmin: boolean;
  currentUserId?: string;
  onEdit: (staff: Staff) => void;
  onActivate: (staff: Staff) => void;
  onDeactivate: (staff: Staff) => void;
  onResendInvite: (staff: Staff) => void;
}) {
  const isCurrentUser = staff.id === currentUserId;

  return (
    <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            {staff.avatarUrl ? (
              <img
                src={staff.avatarUrl}
                alt={`${staff.firstName} ${staff.lastName}`}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {staff.firstName?.[0] || ""}{staff.lastName?.[0] || ""}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">
              {staff.firstName} {staff.lastName}
              {isCurrentUser && (
                <span className="ml-2 text-xs text-muted-foreground">(You)</span>
              )}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {staff.email}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4">
        <RoleBadge role={staff.role} />
      </td>
      <td className="p-4">
        <StatusBadge isActive={staff.isActive} />
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {staff.lastLoginAt
          ? format(new Date(staff.lastLoginAt), "MMM d, yyyy")
          : "Never"}
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {format(new Date(staff.createdAt), "MMM d, yyyy")}
      </td>
      <td className="p-4">
        {isSuperAdmin && !isCurrentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(staff)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResendInvite(staff)}>
                <Send className="mr-2 h-4 w-4" />
                Resend Invite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {staff.isActive ? (
                <DropdownMenuItem
                  onClick={() => onDeactivate(staff)}
                  className="text-destructive"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onActivate(staff)}
                  className="text-emerald-600"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

function CreateStaffDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMutation = useCreateStaff();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateStaffForm>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "viewer",
    },
  });

  const onSubmit = async (data: CreateStaffForm) => {
    await createMutation.mutateAsync(data as CreateStaffDto);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Create a new staff member account. They will receive an email to set up their password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                placeholder="John"
                {...register("firstName")}
                disabled={createMutation.isPending}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                {...register("lastName")}
                disabled={createMutation.isPending}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@example.com"
              {...register("email")}
              disabled={createMutation.isPending}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={watch("role")}
              onValueChange={(value) => setValue("role", value as StaffRole)}
              disabled={createMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {STAFF_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Staff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMutation = useUpdateStaff();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateStaffForm>({
    resolver: zodResolver(updateStaffSchema),
    values: staff
      ? {
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: staff.role,
        }
      : undefined,
  });

  const onSubmit = async (data: UpdateStaffForm) => {
    if (!staff) return;
    await updateMutation.mutateAsync({ id: staff.id, dto: data as UpdateStaffDto });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
          <DialogDescription>
            Update staff member details. Email cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={staff?.email || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editFirstName">First Name *</Label>
              <Input
                id="editFirstName"
                placeholder="John"
                {...register("firstName")}
                disabled={updateMutation.isPending}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="editLastName">Last Name *</Label>
              <Input
                id="editLastName"
                placeholder="Doe"
                {...register("lastName")}
                disabled={updateMutation.isPending}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editRole">Role *</Label>
            <Select
              value={watch("role")}
              onValueChange={(value) => setValue("role", value as StaffRole)}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {STAFF_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
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
  );
}

function StaffContent() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const isSuperAdmin = user?.role === "super_admin";

  const { data: staffList, isLoading } = useStaff({
    search: search || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
  });

  const { data: stats } = useStaffStatistics();
  const activateMutation = useActivateStaff();
  const deactivateMutation = useDeactivateStaff();
  const resendInviteMutation = useResendStaffInvite();

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setShowEditDialog(true);
  };

  const handleActivate = async (staff: Staff) => {
    await activateMutation.mutateAsync(staff.id);
  };

  const handleDeactivate = async (staff: Staff) => {
    await deactivateMutation.mutateAsync(staff.id);
  };

  const handleResendInvite = async (staff: Staff) => {
    await resendInviteMutation.mutateAsync(staff.id);
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Staff Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members and their access levels
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats?.active || 0}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats?.inactive || 0}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {stats?.byRole?.super_admin || 0}
                </p>
                <p className="text-sm text-muted-foreground">Super Admins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as StaffRole | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {STAFF_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {STAFF_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSuperAdmin && (
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Staff
            </Button>
          )}
        </div>

        {/* Staff Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : staffList && staffList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                      Staff Member
                    </th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                      Last Login
                    </th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                      Added
                    </th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staff) => (
                    <StaffRow
                      key={staff.id}
                      staff={staff}
                      isSuperAdmin={isSuperAdmin}
                      currentUserId={user?.id}
                      onEdit={handleEdit}
                      onActivate={handleActivate}
                      onDeactivate={handleDeactivate}
                      onResendInvite={handleResendInvite}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-foreground">No staff members found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try adjusting your search" : "Add your first staff member to get started"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateStaffDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <EditStaffDialog
        staff={editingStaff}
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditingStaff(null);
        }}
      />
    </StaffLayout>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute portal="staff">
      <StaffContent />
    </ProtectedRoute>
  );
}
