import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'qa_token';

export const apiClient = axios.create({
  baseURL: '/api',
});

// Request interceptor — attach JWT from localStorage
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — extract error.message from the error body
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ error?: { message?: string }; message?: string }>) => {
    const serverMessage =
      error.response?.data?.error?.message ??
      error.response?.data?.message ??
      error.message;

    return Promise.reject(new Error(serverMessage));
  },
);
