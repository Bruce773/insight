"use client";

import { useEffect, useState } from "react";
import { toastManager, type Toast } from "@/lib/toast-manager";
import { CheckCircleIcon, XCircleIcon, InfoIcon, XIcon } from "./icon";

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((toast) => {
      if (toast.message === "") {
        // Dismiss message
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      } else {
        setToasts((prev) => {
          const existing = prev.find((t) => t.id === toast.id);
          if (existing) {
            return prev;
          }
          return [...prev, toast];
        });
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      toastManager.dismiss(toast.id);
    }, 300);
  };

  const icon =
    toast.type === "success" ? (
      <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
    ) : toast.type === "error" ? (
      <XCircleIcon className="w-5 h-5 flex-shrink-0" />
    ) : (
      <InfoIcon className="w-5 h-5 flex-shrink-0" />
    );

  const bgColor =
    toast.type === "success"
      ? "bg-green-50 border-green-200"
      : toast.type === "error"
        ? "bg-red-50 border-red-200"
        : "bg-blue-50 border-blue-200";

  const iconColor =
    toast.type === "success"
      ? "text-green-600"
      : toast.type === "error"
        ? "text-red-600"
        : "text-blue-600";

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-3
        px-4 py-3
        rounded-lg
        border
        ${bgColor}
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
        transition-all duration-300
        max-w-sm
        shadow-sm
      `}
    >
      <div className={iconColor}>{icon}</div>
      <p className="text-sm font-medium flex-1 text-gray-800">
        {toast.message}
      </p>
      <button
        onClick={handleDismiss}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
        aria-label="Dismiss notification"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
