import { describe, expect, it } from "vitest";
import { formatVolumeIssue, joinDisplayNames, slugify } from "@/lib/utils";

describe("slugify", () => {
  it("lowercases and dasherizes", () => {
    expect(slugify("Fed Holds Rates Steady")).toBe("fed-holds-rates-steady");
  });

  it("strips punctuation and trims dashes", () => {
    expect(slugify("---OpenAI's $2B Round!?---")).toBe("openai-s-2b-round");
  });

  it("caps length at 80 characters", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});

describe("joinDisplayNames", () => {
  it("returns the only name", () => {
    expect(joinDisplayNames(["Reuters"])).toBe("Reuters");
  });

  it("uses 'and' for two", () => {
    expect(joinDisplayNames(["Reuters", "AP"])).toBe("Reuters and AP");
  });

  it("uses Oxford comma for 3+", () => {
    expect(joinDisplayNames(["Reuters", "AP", "BBC"])).toBe("Reuters, AP, and BBC");
  });
});

describe("formatVolumeIssue", () => {
  it("starts at Vol. I in 2026", () => {
    const { volume, issue } = formatVolumeIssue(new Date("2026-01-01T00:00:00Z"));
    expect(volume).toBe("Vol. I");
    expect(issue).toMatch(/^No\. \d{3}$/);
  });

  it("Vol. II in 2027", () => {
    const { volume } = formatVolumeIssue(new Date("2027-06-15T00:00:00Z"));
    expect(volume).toBe("Vol. II");
  });
});
