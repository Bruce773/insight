export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // in ms, 0 = no auto-dismiss
}

type ToastCallback = (toast: Toast) => void;

class ToastManager {
  private callbacks: Set<ToastCallback> = new Set();
  private toastId = 0;

  subscribe(callback: ToastCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notify(toast: Toast) {
    this.callbacks.forEach((callback) => callback(toast));
  }

  show(message: string, type: ToastType = "info", duration = 4000) {
    const id = `toast-${++this.toastId}`;
    const toast: Toast = { id, message, type, duration };
    this.notify(toast);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  success(message: string, duration = 4000) {
    return this.show(message, "success", duration);
  }

  error(message: string, duration = 6000) {
    return this.show(message, "error", duration);
  }

  info(message: string, duration = 4000) {
    return this.show(message, "info", duration);
  }

  dismiss(id: string) {
    this.notify({ id, message: "", type: "info", duration: 0 });
  }
}

export const toastManager = new ToastManager();
