import axios from "axios";

export const AUTH_STORAGE_KEY = "arl-admin-token";
export const USERNAME_STORAGE_KEY = "arl-admin-username";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(AUTH_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      sessionStorage.getItem(AUTH_STORAGE_KEY)
    ) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(USERNAME_STORAGE_KEY);
      window.dispatchEvent(new Event("arl-auth-expired"));
    }

    return Promise.reject(error);
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