import { apiClient } from "../api-client";

export async function listUsers(page = 1, limit = 10, search = "", roleId?: number) {
  const params: any = { page, limit };
  if (search) params.search = search;
  if (roleId) params.role_id = roleId;
  return apiClient.get("/users", { params });
}

export async function getUser(id: number) {
  return apiClient.get(`/users/${id}`);
}
