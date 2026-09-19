import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
const API_TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

// Flag to prevent multiple 401 redirect attempts - reset after 5 seconds
let isRedirecting = false;
let redirectTimeout: NodeJS.Timeout | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Generic API response type
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/**
 * Paginated response type
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Refresh access token using refresh token
 * This is a local implementation to avoid circular imports
 */
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = typeof window !== "undefined" 
    ? localStorage.getItem("refresh_token") 
    : null;

  console.log("[tryRefreshToken] Attempting refresh, has refresh token:", !!refreshToken);

  if (!refreshToken) {
    console.log("[tryRefreshToken] No refresh token found in localStorage");
    return null;
  }

  try {
    // Use a fresh axios instance to avoid interceptors
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    const { accessToken, user } = response.data;
    console.log("[tryRefreshToken] Refresh successful, got new access token");

    // Update localStorage
    if (typeof window !== "undefined" && accessToken) {
      localStorage.setItem("auth_token", accessToken);
      // Also update cookie for middleware
      document.cookie = `auth_token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    }

    return accessToken;
  } catch (error: any) {
    console.error("[tryRefreshToken] Refresh failed:", error?.response?.status, error?.message);
    return null;
  }
}

/**
 * Create axios instance with default configuration
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    async (config) => {
      // Let Axios set the correct Content-Type for FormData
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }

      // Get auth token from localStorage if available
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Handle 401 Unauthorized
      const isPublicEndpoint =
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/register") ||
        originalRequest.url?.includes("/auth/magic-link") ||
        originalRequest.url?.includes("/auth/verify") ||
        originalRequest.url?.includes("/auth/refresh");

      if (error.response?.status === 401 && !isPublicEndpoint && !originalRequest._retry) {
        // Mark request as retried to prevent infinite loops
        originalRequest._retry = true;
        
        // If we're already refreshing, wait for that to complete
        if (isRefreshing && refreshPromise) {
          try {
            const newToken = await refreshPromise;
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, fall through to logout
          }
        } else {
          // Start a new refresh
          isRefreshing = true;
          refreshPromise = tryRefreshToken();
          
          try {
            const newToken = await refreshPromise;
            isRefreshing = false;
            refreshPromise = null;
            
            if (newToken) {
              // Retry the original request with the new token
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return client(originalRequest);
            }
          } catch (refreshError) {
            isRefreshing = false;
            refreshPromise = null;
          }
        }
        
        // Token refresh failed - logout and redirect
        if (!isRedirecting) {
          isRedirecting = true;
          
          // Reset the flag after 5 seconds to allow future redirects
          if (redirectTimeout) clearTimeout(redirectTimeout);
          redirectTimeout = setTimeout(() => {
            isRedirecting = false;
          }, 5000);
          
          // Clear auth data and redirect to login
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("acmp-auth-store");
            document.cookie = "auth_token=; path=/; max-age=0";
            
            // Determine which portal and redirect accordingly
            const path = window.location.pathname;
            let loginPath = "/";
            
            if (path.startsWith("/portal")) {
              loginPath = "/portal/login";
            } else if (path.startsWith("/org")) {
              loginPath = "/org/login";
            } else if (path.startsWith("/app")) {
              loginPath = "/app/login";
            } else if (path.startsWith("/mentor")) {
              loginPath = "/mentor/login";
            }

            // Only redirect if not already on login page to prevent loops
            if (!window.location.pathname.includes("/login")) {
              window.location.href = loginPath;
            }
          }
        }

        return Promise.reject(new Error("Session expired. Please log in again."));
      }

      // Handle network errors
      if (!error.response) {
        const networkError = new Error("Network error. Please check your connection.") as Error & {
          statusCode?: number;
          errors?: string[];
        };
        networkError.statusCode = 0;
        networkError.errors = ["Network error. Please check your connection."];
        return Promise.reject(networkError);
      }

      // Handle API errors
      const errorData = error.response?.data;
      let errorMessage: string;

      if (Array.isArray(errorData?.message)) {
        errorMessage = errorData.message.join(", ");
      } else {
        errorMessage = errorData?.message || error.message || "An error occurred";
      }

      const apiError = new Error(errorMessage) as Error & {
        statusCode?: number;
        errors?: string[];
      };
      apiError.statusCode = errorData?.statusCode || error.response?.status;
      apiError.errors = Array.isArray(errorData?.message) ? errorData.message : [errorMessage];

      return Promise.reject(apiError);
    }
  );

  return client;
};

export const apiClient = createApiClient();

/**
 * Generic API request wrapper
 * Returns the response body directly (what the API returns)
 */
export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

/**
 * API methods for common HTTP operations
 * Returns the response body directly (not wrapped)
 */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: "GET", url, ...config }),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: "POST", url, data, ...config }),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: "PUT", url, data, ...config }),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: "PATCH", url, data, ...config }),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ method: "DELETE", url, ...config }),
};

/**
 * File upload helper
 */
export async function uploadFile(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<ApiResponse<unknown>> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest({
    method: "POST",
    url,
    data: formData,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
}
