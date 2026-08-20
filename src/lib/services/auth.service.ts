import { apiClient, setAuthToken } from "../api-client";

export async function login(user_email: string, password: string = "123456") {
  const res: any = await apiClient.post("/auth/login", { user_email, password });
  if (res.data?.access_token) {
    setAuthToken(res.data.access_token);
  }
  return res;
}

export async function getProfile() {
  return apiClient.get("/auth/me");
}

export async function logout() {
  const res = await apiClient.post("/auth/logout");
  setAuthToken("");
  return res;
}
