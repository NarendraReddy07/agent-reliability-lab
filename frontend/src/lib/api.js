import axios from "axios";

export const AUTH_STORAGE_KEY = "arl-admin-token";
export const REFRESH_STORAGE_KEY = "arl-admin-refresh-token";
export const USERNAME_STORAGE_KEY = "arl-admin-username";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

function clearSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(REFRESH_STORAGE_KEY);
  sessionStorage.removeItem(USERNAME_STORAGE_KEY);
  window.dispatchEvent(new Event("arl-auth-expired"));
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(AUTH_STORAGE_KEY);

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";

    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh");

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRequest
    ) {
      return Promise.reject(error);
    }

    const refreshToken = sessionStorage.getItem(REFRESH_STORAGE_KEY);

    if (!refreshToken) {
      if (sessionStorage.getItem(AUTH_STORAGE_KEY)) {
        clearSession();
      }

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(
            `${baseURL}/auth/refresh`,
            { refresh_token: refreshToken },
            { timeout: 15000 }
          )
          .then((response) => {
            const newAccessToken = response.data?.access_token;

            if (!newAccessToken) {
              throw new Error("Refresh response did not contain an access token.");
            }

            sessionStorage.setItem(AUTH_STORAGE_KEY, newAccessToken);
            return newAccessToken;
          })
          .catch((refreshError) => {
            clearSession();
            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newAccessToken = await refreshPromise;

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export function getApiError(error) {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }

  if (error.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (!error.response) {
    return "Unable to connect to the backend. Check that FastAPI is running.";
  }

  return error.message || "Something went wrong.";
}

export default api;