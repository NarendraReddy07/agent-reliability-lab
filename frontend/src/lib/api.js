
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

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