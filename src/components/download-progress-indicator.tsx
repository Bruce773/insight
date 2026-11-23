import { useEffect, useState } from "react";
import { XIcon } from "./icon";
import { modelManager, type ModelDownloadProgress } from "@/lib/local-model-manager";

export function DownloadProgressIndicator() {
  const [progress, setProgress] = useState<ModelDownloadProgress>({ status: "not-started", progress: 0 });
  const [shouldShow, setShouldShow] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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
      setShouldShow(false);
      setProgress({ status: "not-started", progress: 0 });
      setIsCancelling(false);
    }, 300);
  };

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
