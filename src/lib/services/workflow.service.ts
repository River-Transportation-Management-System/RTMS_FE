import { apiClient } from "../api-client";

export async function getMatchingVessels(bookingId: number) {
  return apiClient.get(`/internal/matching/${bookingId}`);
}

export async function completePortReviewWorkflow(data: {
  booking_id: number;
  port_review_summary: string;
  final_review_decision: "APPROVED" | "REJECTED";
}) {
  return apiClient.post("/internal/workflow/port-review-completed", data);
}

export async function respondVesselWorkflow(data: {
  request_id: number;
  vessel_response_status: "ACCEPTED" | "REJECTED";
  response_timestamp: string;
}) {
  return apiClient.post("/internal/workflow/vessel-response", data);
}

export async function getWorkflowSnapshot(bookingId: number) {
  return apiClient.get(`/internal/workflow/${bookingId}`);
}

export async function customerSelectedWorkflow(data: {
  booking_id: number;
  selected_vessel_id: number;
}) {
  return apiClient.post("/internal/workflow/customer-selected", data);
}

export async function patchWorkflowData(bookingId: number, data: any) {
  return apiClient.patch(`/internal/workflow/${bookingId}`, data);
}

export async function publishEvent(data: {
  event_name: string;
  entity_ids: Record<string, number>;
  payload: Record<string, any>;
  source_service: string;
  timestamp: string;
}) {
  return apiClient.post("/internal/events", data);
}

export async function triggerJobBookingExpired() {
  return apiClient.post("/internal/jobs/booking-expired");
}

export async function triggerJobVesselTimeout() {
  return apiClient.post("/internal/jobs/vessel-request-timeout");
}

export async function triggerJobSendReminder(data: {
  booking_ids: number[];
  reminder_target_context: string;
}) {
  return apiClient.post("/internal/jobs/send-reminder", data);
}
