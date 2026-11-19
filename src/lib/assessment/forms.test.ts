import { describe, expect, it } from "vitest";
import { createAssessmentForm } from "./forms";

describe("assessment form verification", () => {
  it("rejects incomplete or unverified item sets", () => {
    expect(createAssessmentForm("quick", [])).toBeNull();
    const synthetic = Array.from({ length: 20 }, (_, index) => ({
      id: `test-${index}`,
      text: `Synthetic test item ${index}`,
      domain: "Test domain",
      facet: null,
      reverseKeyed: false,
    }));
    expect(createAssessmentForm("quick", synthetic)).toBeNull();
    expect(createAssessmentForm("full", synthetic)).toBeNull();
    expect(createAssessmentForm("quick", synthetic.map((item) => ({ ...item, id: "duplicate" })))).toBeNull();
  });
});
