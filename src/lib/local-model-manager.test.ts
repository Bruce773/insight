import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const webllm = vi.hoisted(() => ({
  hasModelInCache: vi.fn(),
  deleteModelAllInfoInCache: vi.fn(),
  CreateMLCEngine: vi.fn(),
}));
vi.mock("@mlc-ai/web-llm", () => webllm);

describe("local model manager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const values = new Map<string, string>();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    webllm.hasModelInCache.mockResolvedValue(true);
    webllm.deleteModelAllInfoInCache.mockResolvedValue(undefined);
    webllm.CreateMLCEngine.mockResolvedValue({ unload: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("removes the cached model, notifies subscribers, and permits downloading again", async () => {
    const { modelManager, LOCAL_MODEL_ID } = await import("./local-model-manager");
    const updates = vi.fn();
    const unsubscribe = modelManager.onProgress(updates);
    expect(await modelManager.isModelCached()).toBe(true);

    await modelManager.removeModel();
    expect(webllm.deleteModelAllInfoInCache).toHaveBeenCalledWith(LOCAL_MODEL_ID);
    expect(modelManager.getDownloadStatus()).toBe("not-started");
    expect(modelManager.hasUserDeclined()).toBe(true);
    expect(updates).toHaveBeenLastCalledWith({ status: "not-started", progress: 0 });

    webllm.hasModelInCache.mockResolvedValue(false);
    expect(await modelManager.startDownload()).toBe(true);
    expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(LOCAL_MODEL_ID, expect.any(Object));
    expect(updates).toHaveBeenLastCalledWith({ status: "completed", progress: 100 });
    unsubscribe();
  });

  it("invalidates ready state and reports a partial removal failure", async () => {
    const { modelManager } = await import("./local-model-manager");
    modelManager.markModelReady();
    webllm.deleteModelAllInfoInCache.mockRejectedValue(new Error("Storage unavailable"));
    const updates = vi.fn();
    const unsubscribe = modelManager.onProgress(updates);

    await expect(modelManager.removeModel()).rejects.toThrow("Storage unavailable");
    expect(modelManager.getDownloadStatus()).toBe("not-started");
    expect(localStorage.getItem("local-model-completed")).toBeNull();
    expect(updates).toHaveBeenLastCalledWith({ status: "not-started", progress: 0 });
    unsubscribe();
  });

  it("does not allow removal while a download is still running", async () => {
    const { modelManager } = await import("./local-model-manager");
    webllm.hasModelInCache.mockResolvedValue(false);
    let finish!: (engine: { unload: () => Promise<void> }) => void;
    webllm.CreateMLCEngine.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const download = modelManager.startDownload();
    await vi.waitFor(() => expect(webllm.CreateMLCEngine).toHaveBeenCalled());
    modelManager.cancelDownload();
    await expect(modelManager.removeModel()).rejects.toThrow("Wait for the model download");
    finish({ unload: async () => {} });
    expect(await download).toBe(false);
    expect(modelManager.getDownloadStatus()).toBe("completed");
  });
});
