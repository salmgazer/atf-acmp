"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ChangePasswordModal } from "./change-password-modal";

interface RequirePasswordChangeProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that forces password change if user has mustChangePassword flag
 */
export function RequirePasswordChange({ children }: RequirePasswordChangeProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.mustChangePassword) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [isAuthenticated, user?.mustChangePassword]);

  const handlePasswordChanged = () => {
    setShowModal(false);
  };

  return (
    <>
      {children}
      <ChangePasswordModal
        open={showModal}
        required={true}
        onSuccess={handlePasswordChanged}
      />
    </>
  );
}
