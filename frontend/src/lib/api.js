import axios from "axios";

export const AUTH_STORAGE_KEY = "arl-admin-token";
export const REFRESH_STORAGE_KEY = "arl-admin-refresh-token";
export const USERNAME_STORAGE_KEY = "arl-admin-username";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";
const REQUEST_TIMEOUT_MS = 90000;
const HEALTH_CHECK_TIMEOUT_MS = 10000;
const BACKEND_STARTUP_TIMEOUT_MS = 90000;

const api = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS,
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

/**
 * Render free instances may sleep after inactivity. Poll the public health
 * endpoint before login so the user sees a useful waking-up state instead of
 * a misleading connection failure.
 */
export async function waitForBackend(onStatus = () => {}) {
  const deadline = Date.now() + BACKEND_STARTUP_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    onStatus(
      attempt === 1
        ? "Connecting to the backend..."
        : "The backend is waking up. This can take up to a minute on the free hosting plan."
    );

    try {
      const response = await api.get("/health", {
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });

      if (response.data?.status === "healthy") {
        onStatus("Backend ready. Signing you in...");
        return true;
      }
    } catch {
      // A sleeping instance, an in-progress startup, or a temporarily
      // unavailable database can all make the health check fail. Retry.
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2500));
  }

  throw new Error(
    "The backend did not become ready within 90 seconds. Please try again in a moment."
  );
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
            { timeout: REQUEST_TIMEOUT_MS }
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
    return "The backend is taking longer than expected to respond. Please retry.";
  }

  if (!error.response) {
    return "Unable to reach the backend. It may still be waking up. Please retry.";
  }

  return error.message || "Something went wrong.";
}

export default api;
