"use client";

import { useState } from "react";
import type { Duration, Roadmap } from "@/lib/engine/roadmap";
import { DownloadIcon, LinkIcon, CopyIcon } from "@/components/icon";
import { RoadmapPreview } from "@/components/roadmap-preview";

export function RoadmapPlannerStep4({
  roadmap,
  duration,
  onBack,
}: {
  roadmap: Roadmap;
  duration?: Duration;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [error, setError] = useState("");

  async function generateShareLink() {
    setGeneratingLink(true);
    setError("");
    try {
      const response = await fetch("/api/roadmap/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmap, duration }),
      });

      if (!response.ok) throw new Error("Failed to generate share link");

      const data = await response.json();
      setShareLink(data.link);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate a share link.");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setError("");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link. Select and copy it manually.");
    }
  }

  function downloadPDF() {
    const element = document.querySelector<HTMLElement>(".roadmap-final-view");
    if (!element) {
      setError("Could not prepare the roadmap for printing.");
      return;
    }

    const printable = element.cloneNode(true);
    if (!(printable instanceof HTMLElement)) {
      setError("Could not prepare the roadmap for printing.");
      return;
    }
    printable.querySelectorAll("details").forEach((details) => { details.open = true; });
    printable.querySelectorAll(".final-step-chevron, .hint").forEach((element) => element.remove());

    const printWindow = window.open("", "", "height=400,width=800");
    if (!printWindow) {
      setError("Could not open the print window. Allow pop-ups and try again.");
      return;
    }

    printWindow.document.write("<html><head><title>My Roadmap</title><style>.final-step-header { display: flex; gap: 0.75em; } .roadmap-final-step { break-inside: avoid; }</style></head><body>");
    printWindow.document.write(printable.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  }

  function downloadJSON() {
    const data = {
      roadmap,
      duration,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roadmap-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="roadmap-planner-wrapper">
      <div className="roadmap-planner-step4">
        <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
        <h1>Your roadmap is ready</h1>
        <p className="lead">
          Here&apos;s your personalized plan. You can export it, share it, or come back to edit it anytime.
        </p>

        <RoadmapPreview roadmap={roadmap} duration={duration} />

        <div className="roadmap-export-section">
          <h2>Share & export your roadmap</h2>

          <div className="export-options">
            <div className="export-option">
              <h3>
                <LinkIcon /> Share via link
              </h3>
              <p>Create a read-only link containing your roadmap. Anyone with the link can see its contents; do not share it publicly if it contains private information.</p>
              {shareLink ? (
                <div className="share-link-display">
                  <input type="text" value={shareLink} readOnly aria-label="Roadmap share link" />
                  <button
                    type="button"
                    className="text-button"
                    onClick={copyToClipboard}
                    aria-label="Copy share link"
                  >
                    {copied ? "Copied!" : <CopyIcon />}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={generateShareLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? "Generating..." : "Generate share link"}
                </button>
              )}
            </div>

            <div className="export-option">
              <h3>
                <DownloadIcon /> Download
              </h3>
              <p>Save your roadmap to your device</p>
              <div className="download-buttons">
                <button type="button" className="secondary" onClick={downloadPDF}>
                  Print / save as PDF
                </button>
                <button type="button" className="secondary" onClick={downloadJSON}>
                  Download as JSON
                </button>
              </div>
              {error && <p role="alert">{error}</p>}
            </div>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="text-button" onClick={onBack}>
            Edit roadmap
          </button>
        </div>
      </div>
    </div>
  );
}
