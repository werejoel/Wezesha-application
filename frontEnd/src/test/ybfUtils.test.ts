import { describe, expect, it } from "vitest";
import { normalizeMilestoneType, buildCalendarLink } from "@/pages/ybf/utils";

describe("YBF workflow helpers", () => {
  it("combines legacy application and business plan milestones into the new workflow", () => {
    expect(normalizeMilestoneType("Application Letter")).toBe(
      "Application Letter & Business Plan",
    );
    expect(normalizeMilestoneType("Business Plan")).toBe(
      "Application Letter & Business Plan",
    );
    expect(normalizeMilestoneType("Business Ideas")).toBe("Business Ideas");
  });

  it("builds a calendar link for session scheduling", () => {
    const link = buildCalendarLink({
      topic: "Business Planning",
      date: "2026-08-10",
      venue: "Kampala",
      partner: "Wezesha",
    });

    expect(link).toContain("https://calendar.google.com/calendar/render");
    expect(link).toContain("Business+Planning");
    expect(link).toContain("Kampala");
  });
});
