import { apiClient } from "../api-client";

export async function listPorts() {
  return apiClient.get("/ports");
}

export async function getPort(id: number) {
  return apiClient.get(`/ports/${id}`);
}
