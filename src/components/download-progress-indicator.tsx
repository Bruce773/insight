import { useEffect, useState } from "react";
import { XIcon, InfoIcon } from "./icon";
import { modelManager, type ModelDownloadProgress } from "@/lib/local-model-manager";

export function DownloadProgressIndicator({ onOpenModal }: { onOpenModal?: () => void }) {
  const [progress, setProgress] = useState<ModelDownloadProgress>({ status: "not-started", progress: 0 });
  const [shouldShow, setShouldShow] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [wasCancelled, setWasCancelled] = useState(false);

  useEffect(() => {
    const unsubscribe = modelManager.onProgress((update) => {
      setProgress(update);
      setShouldShow(true);
      setIsCancelling(false);

      // Hide after completion after 2 seconds
      if (update.status === "completed") {
        const timer = setTimeout(() => {
          setShouldShow(false);
          setProgress({ status: "not-started", progress: 0 });
          setWasCancelled(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!shouldShow) {
    return null;
  }

  const isComplete = progress.status === "completed";

  const handleCancel = () => {
    setIsCancelling(true);
    modelManager.cancelDownload();
    setTimeout(() => {
      setWasCancelled(true);
      setProgress({ status: "not-started", progress: 0 });
      setIsCancelling(false);
    }, 300);
  };

  const handleRestart = () => {
    setWasCancelled(false);
    setProgress({ status: "not-started", progress: 0 });
    modelManager.startDownload();
  };

  if (wasCancelled) {
    return (
      <div className="download-indicator cancelled">
        <div className="download-label">Download cancelled</div>
        <div className="download-actions">
          <button
            className="download-restart-button"
            onClick={handleRestart}
            aria-label="Restart download"
          >
            Restart Download
          </button>
          <button
            className="download-info-button"
            onClick={onOpenModal}
            aria-label="Learn more about the AI model"
          >
            <InfoIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`download-indicator ${isComplete ? "complete" : ""}`}>
      <div className="download-label">
        {isComplete ? "✓ AI model ready" : `Downloading AI model… ${progress.progress}%`}
      </div>
      <div className="download-bar">
        <div
          className="download-fill"
          style={{ width: `${isComplete ? 100 : progress.progress}%` }}
        />
      </div>
      {!isComplete && (
        <button
          className="download-cancel-icon"
          onClick={handleCancel}
          disabled={isCancelling}
          aria-label="Cancel download"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}
