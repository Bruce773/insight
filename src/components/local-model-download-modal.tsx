"use client";

import { createPortal } from "react-dom";
import { modelManager } from "@/lib/local-model-manager";
import { LockIcon, EyeIcon, ZapIcon } from "./icon";

export function LocalModelDownloadModal({
  isOpen,
  onAccept,
  onDecline,
}: {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const handleAccept = () => {
    // Start download in background but don't wait for it
    modelManager.startDownload();
    modelManager.setUserPreference(false);
    // Close modal immediately - download continues in background
    onAccept();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="model-download-modal-overlay" 
      onClick={() => {
        modelManager.setUserPreference(true);
        modelManager.cancelDownload();
        onDecline();
      }}
    >
      <div className="model-download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Your Data, Your Device</h2>
          <button
            onClick={() => {
              modelManager.setUserPreference(true);
              modelManager.cancelDownload();
              onDecline();
            }}
            className="modal-close"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
          <p className="modal-lead">
            You can optionally run an AI model in your browser to suggest ideas for your roadmap.
          </p>

          <div className="privacy-benefits">
            <div className="benefit-item">
              <LockIcon className="benefit-icon" />
              <div>
                <strong>Your data stays private</strong>
                <p>Inputs for local generation stay on your device</p>
              </div>
            </div>
            <div className="benefit-item">
              <EyeIcon className="benefit-icon" />
              <div>
                <strong>You choose what to share</strong>
                <p>Saving or sharing a plan sends its contents to the app</p>
              </div>
            </div>
            <div className="benefit-item">
              <ZapIcon className="benefit-icon" />
              <div>
                <strong>Works offline</strong>
                <p>No internet needed after download</p>
              </div>
            </div>
          </div>

          <div className="recommendation-box">
            <p>
              Download now (approximately 2.4 GB, cached in your browser). It requires WebGPU and sufficient device memory.
            </p>
          </div>

        </div>

        <div className="modal-actions">
          <button
            className="primary"
            onClick={handleAccept}
          >
            Download to browser
          </button>
          <button className="text-button" onClick={onDecline}>
            Skip for now
          </button>
        </div>

        <p className="modal-footnote">
          Completely free. Download anytime from the final step.
        </p>
      </div>
    </div>,
    document.body
  );
}
