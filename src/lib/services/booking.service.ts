import { apiClient } from "../api-client";

export async function listBookings(params: {
  page?: number;
  limit?: number;
  booking_status?: string;
  user_id?: number;
  route_id?: number;
} = {}) {
  return apiClient.get("/bookings", { params });
}

export async function createBooking(data: {
  user_id: number;
  route_id: number;
  cargo_type: string;
  cargo_capacity: number;
  receive_date: string;
  expected_date: string;
  notes?: string;
}) {
  return apiClient.post("/bookings", data);
}

export async function getBooking(id: number) {
  return apiClient.get(`/bookings/${id}`);
}

export async function updateBooking(id: number, data: any) {
  return apiClient.patch(`/bookings/${id}`, data);
}

export async function cancelBooking(id: number) {
  return apiClient.delete(`/bookings/${id}`);
}

export async function createPortReview(bookingId: number, data: {
  port_id: number;
  review_status: "APPROVED" | "REJECTED" | "REQUIRES_UPDATE";
  review_note?: string;
}) {
  return apiClient.post(`/bookings/${bookingId}/port-review`, data);
}

export async function listPortReviews(bookingId: number) {
  return apiClient.get(`/bookings/${bookingId}/port-reviews`);
}

export async function getBookingVesselRequests(bookingId: number) {
  return apiClient.get(`/bookings/${bookingId}/vessel-requests`);
}

export async function selectVessel(bookingId: number, data: {
  match_id: number;
  selected_vessel_id: number;
  selection_note?: string;
}) {
  return apiClient.post(`/bookings/${bookingId}/selected-vessel`, data);
}

export async function getSelectedVessel(bookingId: number) {
  return apiClient.get(`/bookings/${bookingId}/selected-vessel`);
}

export async function finalConfirmBooking(bookingId: number, data: {
  port_id: number;
  confirmation_note?: string;
}) {
  return apiClient.post(`/bookings/${bookingId}/final-confirmation`, data);
}

export async function listCargoTypes() {
  return apiClient.get("/cargo_type");
}
