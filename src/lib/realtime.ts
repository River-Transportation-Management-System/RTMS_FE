type NotificationHandler = (notification: RealtimeNotification) => void;

export type RealtimeNotification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  roleTarget?: "ADMIN" | "CUSTOMER" | "PORT_MANAGER" | "VESSEL_OWNER" | "ALL";
};

class RealtimeHub {
  private listeners: Set<NotificationHandler> = new Set();

  subscribe(handler: NotificationHandler) {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  notify(event: Omit<RealtimeNotification, "id" | "timestamp">) {
    const notification: RealtimeNotification = {
      ...event,
      id: "notif_" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("vi-VN"),
    };

    this.listeners.forEach((handler) => handler(notification));
  }
}

export const realtimeHub = new RealtimeHub();
