/**
 * Manages downloading and managing local AI models for browser-based inference
 */

import { toastManager } from "./toast-manager";

const MODEL_DOWNLOAD_KEY = "local-model-download-preference";
const MODEL_STATUS_KEY = "local-model-status";
const MODEL_COMPLETED_KEY = "local-model-completed";
export const LOCAL_MODEL_ID = "Qwen3.5-4B-q4f32_1-MLC";

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
  private downloadActive = false;
  private removing = false;
  private cacheRevision = 0;
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
   * Check if model has been successfully downloaded and cached
   */
  async isModelCached(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const revision = this.cacheRevision;
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    const cached = await hasModelInCache(LOCAL_MODEL_ID);
    if (this.removing) return false;
    if (revision !== this.cacheRevision) return localStorage.getItem(MODEL_COMPLETED_KEY) === "true";
    if (cached !== (localStorage.getItem(MODEL_COMPLETED_KEY) === "true")) {
      this.setCached(cached);
    }
    return cached;
  }

  private setCached(cached: boolean): void {
    this.cacheRevision++;
    if (cached) {
      localStorage.setItem(MODEL_COMPLETED_KEY, "true");
      localStorage.setItem(MODEL_STATUS_KEY, "completed");
    } else {
      localStorage.removeItem(MODEL_COMPLETED_KEY);
      localStorage.setItem(MODEL_STATUS_KEY, "not-started");
    }
    this.notifyProgress({ status: cached ? "completed" : "not-started", progress: cached ? 100 : 0 });
  }

  markModelReady(): void {
    this.setCached(true);
  }

  async removeModel(): Promise<void> {
    if (this.downloadActive || this.removing) {
      throw new Error("Wait for the model download to finish before removing it.");
    }
    this.removing = true;
    try {
      const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
      await deleteModelAllInfoInCache(LOCAL_MODEL_ID);
      this.setUserPreference(true);
      this.setCached(false);
    } catch (error) {
      // Removal can fail after deleting some files, so do not claim the model is ready.
      this.setCached(false);
      throw error;
    } finally {
      this.removing = false;
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
    if (this.downloadActive || this.removing) {
      toastManager.info("Wait for the current model operation to finish.");
      return false;
    }
    this.downloadActive = true;
    this.downloadController = new AbortController();
    const controller = this.downloadController;
    let stallDetector: ReturnType<typeof setInterval> | undefined;
    let modelLoaded = false;

    try {
      const isCached = await this.isModelCached();
      if (controller.signal.aborted) return false;
      if (isCached) {
        onProgress?.({ status: "completed", progress: 100 });
        return true;
      }
      localStorage.setItem(MODEL_STATUS_KEY, "downloading");
      const progressUpdate = { status: "downloading" as const, progress: 0 };
      onProgress?.(progressUpdate);
      this.notifyProgress(progressUpdate);

      // Use the web-llm library's CreateMLCEngine to download and cache the model
      // The library handles all CDN URLs, caching, and verification
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      
      let lastProgress = 0;
      let lastProgressTime = Date.now();
      const STALL_TIMEOUT = 30000; // 30 seconds without progress
      
      const downloadPromise = CreateMLCEngine(LOCAL_MODEL_ID, {
        initProgressCallback: ({ progress }) => {
          if (controller.signal.aborted) return;
          
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
      stallDetector = setInterval(() => {
        if (controller.signal.aborted) {
          clearInterval(stallDetector);
          return;
        }
        
        const timeSinceLastProgress = Date.now() - lastProgressTime;
        if (timeSinceLastProgress > STALL_TIMEOUT && lastProgress < 100) {
          console.warn(`Download stalled at ${lastProgress}% after ${timeSinceLastProgress}ms`);
          this.downloadController?.abort();
        }
      }, 5000); // Check every 5 seconds

      const engine = await downloadPromise;
      await engine.unload();
      modelLoaded = true;
      if (controller.signal.aborted) return false;
      const completed = { status: "completed" as const, progress: 100 };
      onProgress?.(completed);
      this.markModelReady();
      toastManager.success("AI model downloaded successfully");

      return true;
    } catch (error) {
      if (controller.signal.aborted) {
        // Download was cancelled
        localStorage.setItem(MODEL_STATUS_KEY, "not-started");
        localStorage.removeItem(MODEL_COMPLETED_KEY);
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Model download error:", errorMessage);
      localStorage.setItem(MODEL_STATUS_KEY, "failed");
      localStorage.removeItem(MODEL_COMPLETED_KEY);
      const failed = {
        status: "failed" as const,
        progress: 0,
        error: errorMessage,
      };
      onProgress?.(failed);
      this.notifyProgress(failed);
      toastManager.error(`Model download failed: ${errorMessage}`);

      return false;
    } finally {
      if (stallDetector) clearInterval(stallDetector);
      if (controller.signal.aborted) this.setCached(modelLoaded);
      this.downloadController = null;
      this.downloadActive = false;
    }
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload(): void {
    if (this.downloadController) {
      this.downloadController.abort();
    }
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: ModelDownloadProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    const onStorage = (event: StorageEvent) => {
      if (event.key === MODEL_STATUS_KEY) {
        this.cacheRevision++;
        const status = this.getDownloadStatus();
        callback({ status, progress: status === "completed" ? 100 : 0 });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      this.progressCallbacks.delete(callback);
      window.removeEventListener("storage", onStorage);
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
