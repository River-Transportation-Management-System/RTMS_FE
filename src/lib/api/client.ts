import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message ?? `RTMS API request failed with status ${status}`;
      return Promise.reject(new ApiError(message, status, error.response.data));
    }

    if (error.request) {
      return Promise.reject(new ApiError("Cannot reach RTMS API server", 0));
    }

    return Promise.reject(new ApiError(error.message, 0));
  },
);

export async function apiGet<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(path, config);
  return data;
}

export async function apiPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const { data } = await api.post<TResponse>(path, body, config);
  return data;
}

export async function apiPatch<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const { data } = await api.patch<TResponse>(path, body, config);
  return data;
}

export async function apiDelete<TResponse>(path: string, config?: AxiosRequestConfig): Promise<TResponse> {
  const { data } = await api.delete<TResponse>(path, config);
  return data;
}
