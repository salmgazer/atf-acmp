import { useMutation } from "@tanstack/react-query";
import { changePassword } from "@/lib/auth";

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordResponse {
  message: string;
}

/**
 * Hook for changing the user's password
 */
export function useChangePassword() {
  return useMutation<ChangePasswordResponse, Error, ChangePasswordDto>({
    mutationFn: async (data: ChangePasswordDto) => {
      return changePassword(data.currentPassword, data.newPassword);
    },
  });
}
