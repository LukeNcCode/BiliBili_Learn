import { describe, expect, it } from "vitest";
import { chooseSemanticSubject } from "./semanticTaxonomy";

describe("local semantic subject taxonomy", () => {
  it("selects the highest-scoring subject and reports its margin", () => {
    const result = chooseSemanticSubject({
      medicine: 0.64,
      science: 0.46,
      general: 0.31,
    });

    expect(result.subject).toBe("medicine");
    expect(result.score).toBe(0.64);
    expect(result.margin).toBeCloseTo(0.18);
  });

  it("keeps engineering ahead of science for control theory", () => {
    const result = chooseSemanticSubject({
      engineering: 0.58,
      science: 0.36,
      math: 0.47,
    });

    expect(result.subject).toBe("engineering");
  });
});
