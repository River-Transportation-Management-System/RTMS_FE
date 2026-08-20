import { apiClient } from "../api-client";

export async function listVessels(params: {
  page?: number;
  limit?: number;
  vessel_status?: "ACTIVE" | "INACTIVE";
  vessel_cargo_type?: string;
  user_id?: number;
} = {}) {
  return apiClient.get("/vessels", { params });
}

export async function createVessel(data: {
  vessel_owner_name: string;
  vessel_capacity: number;
  vessel_cargo_type: string;
  vessel_status: "ACTIVE" | "INACTIVE";
  user_id: number;
}) {
  return apiClient.post("/vessels", data);
}

export async function getVessel(id: number) {
  return apiClient.get(`/vessels/${id}`);
}

export async function updateVessel(id: number, data: {
  vessel_owner_name?: string;
  vessel_capacity?: number;
  vessel_cargo_type?: string;
  vessel_status?: "ACTIVE" | "INACTIVE";
}) {
  return apiClient.patch(`/vessels/${id}`, data);
}

export async function respondVesselMatch(matchId: number, data: {
  response_status: "ACCEPT" | "REJECT";
  reason?: string;
}) {
  return apiClient.post(`/vessel-matches/${matchId}/response`, data);
}
