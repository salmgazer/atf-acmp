import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

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
      const response = await api.post<ChangePasswordResponse>("/auth/change-password", data);
      return response.data;
    },
  });
}
