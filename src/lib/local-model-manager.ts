/**
 * Manages downloading and managing local AI models for browser-based inference
 */

const MODEL_DOWNLOAD_KEY = "local-model-download-preference";
const MODEL_CACHE_NAME = "local-ai-model-v1";
const MODEL_STATUS_KEY = "local-model-status";

export type ModelStatus = "not-started" | "downloading" | "completed" | "failed";

export interface ModelDownloadProgress {
  status: ModelStatus;
  progress: number; // 0-100
  error?: string;
  size?: number;
  downloaded?: number;
}

class LocalModelManager {
  private static instance: LocalModelManager;
  private downloadController: AbortController | null = null;
  private progressCallbacks: Set<(progress: ModelDownloadProgress) => void> = new Set();

  private constructor() {}

  static getInstance(): LocalModelManager {
    if (!LocalModelManager.instance) {
      LocalModelManager.instance = new LocalModelManager();
    }
    return LocalModelManager.instance;
  }

  /**
   * Check if user has previously declined the model download
   */
  hasUserDeclined(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MODEL_DOWNLOAD_KEY) === "declined";
  }

  /**
   * Check if model has been downloaded
   */
  async isModelCached(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const cache = await caches.open(MODEL_CACHE_NAME);
      const response = await cache.match("local-model");
      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Get current download status
   */
  getDownloadStatus(): ModelStatus {
    if (typeof window === "undefined") return "not-started";
    const status = localStorage.getItem(MODEL_STATUS_KEY) as ModelStatus | null;
    return status || "not-started";
  }

  /**
   * Save user's preference to skip download prompt
   */
  setUserPreference(declined: boolean): void {
    if (typeof window === "undefined") return;
    if (declined) {
      localStorage.setItem(MODEL_DOWNLOAD_KEY, "declined");
    } else {
      localStorage.removeItem(MODEL_DOWNLOAD_KEY);
    }
  }

  /**
   * Start downloading the local model in background
   * Returns a promise that resolves when download is complete or fails
   */
  async startDownload(onProgress?: (progress: ModelDownloadProgress) => void): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Check if already cached
    const isCached = await this.isModelCached();
    if (isCached) {
      onProgress?.({ status: "completed", progress: 100 });
      return true;
    }

    this.downloadController = new AbortController();
    localStorage.setItem(MODEL_STATUS_KEY, "downloading");

    try {
      const progressUpdate = { status: "downloading" as const, progress: 0 };
      onProgress?.(progressUpdate);
      this.notifyProgress(progressUpdate);

      // Use the web-llm library's CreateMLCEngine to download and cache the model
      // The library handles all CDN URLs, caching, and verification
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      
      let lastProgress = 0;
      let lastProgressTime = Date.now();
      const STALL_TIMEOUT = 30000; // 30 seconds without progress
      
      const downloadPromise = CreateMLCEngine("Qwen3.5-4B-q4f32_1-MLC", {
        initProgressCallback: ({ progress }) => {
          if (!this.downloadController) return; // Download was cancelled
          
          const numProgress = Math.round(progress * 100);
          if (numProgress !== lastProgress) {
            lastProgress = numProgress;
            lastProgressTime = Date.now();
          }
          
          const update = { status: "downloading" as const, progress: numProgress };
          onProgress?.(update);
          this.notifyProgress(update);
        },
      });

      // Set up a stall detector to handle stuck downloads
      const stallDetector = setInterval(() => {
        if (!this.downloadController) {
          clearInterval(stallDetector);
          return;
        }
        
        const timeSinceLastProgress = Date.now() - lastProgressTime;
        if (timeSinceLastProgress > STALL_TIMEOUT && lastProgress < 100) {
          console.warn(`Download stalled at ${lastProgress}% after ${timeSinceLastProgress}ms`);
          this.downloadController?.abort();
        }
      }, 5000); // Check every 5 seconds

      await downloadPromise;
      clearInterval(stallDetector);

      localStorage.setItem(MODEL_STATUS_KEY, "completed");
      const completed = { status: "completed" as const, progress: 100 };
      onProgress?.(completed);
      this.notifyProgress(completed);

      return true;
    } catch (error) {
      if (!this.downloadController) {
        // Download was cancelled
        localStorage.setItem(MODEL_STATUS_KEY, "not-started");
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Model download error:", errorMessage);
      localStorage.setItem(MODEL_STATUS_KEY, "failed");
      const failed = {
        status: "failed" as const,
        progress: 0,
        error: errorMessage,
      };
      onProgress?.(failed);
      this.notifyProgress(failed);

      return false;
    } finally {
      this.downloadController = null;
    }
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload(): void {
    if (this.downloadController) {
      this.downloadController.abort();
      this.downloadController = null;
    }
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: ModelDownloadProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Notify all subscribers of progress
   */
  private notifyProgress(progress: ModelDownloadProgress): void {
    this.progressCallbacks.forEach((callback) => callback(progress));
  }
}

export const modelManager = LocalModelManager.getInstance();
