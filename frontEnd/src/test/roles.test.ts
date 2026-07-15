import { describe, expect, it } from "vitest";
import { normalizeRole } from "@/lib/roles";

describe("normalizeRole", () => {
  it("maps the new management roles to stable identifiers", () => {
    expect(normalizeRole("Program Leadership")).toBe("program_leadership");
    expect(normalizeRole("Program Manager Out of School")).toBe(
      "program_manager_out_of_school",
    );
    expect(normalizeRole("Program Manager In School")).toBe(
      "program_manager_in_school",
    );
    expect(normalizeRole("Program Supervisor")).toBe("program_supervisor");
  });

  it("drops the old enumerator role in favor of instructor access", () => {
    expect(normalizeRole("Enumerator")).toBe("instructor");
  });
});
