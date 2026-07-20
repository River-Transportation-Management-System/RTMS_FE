/** Workflow states required by the RTMS analysis report. */
export const BOOKING_STATUSES = [
  "PENDING_PORT_REVIEW",
  "WAITING_VESSEL_RESPONSE",
  "VESSEL_CANDIDATES_READY",
  "WAITING_CUSTOMER_SELECTION",
  "WAITING_FINAL_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED_BY_PORT",
  "INVALID_ROUTE",
  "NO_VESSEL_AVAILABLE",
  "NO_VESSEL_ACCEPTED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Placeholder status values for BookingReview.review_status */
export const REVIEW_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Placeholder status values for Shipment.shipment_status */
export const SHIPMENT_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
