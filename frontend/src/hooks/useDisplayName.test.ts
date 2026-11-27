import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISPLAY_NAME,
  dashboardTitleFrom,
  displayNameFrom,
  initialsFrom,
} from "./useDisplayName";

describe("displayNameFrom", () => {
  it("prefers the saved profile name", () => {
    expect(
      displayNameFrom(
        { profile: { display_name: "Carlito G" } },
        { first_name: "Local", username: "local" },
      ),
    ).toBe("Carlito G");
  });

  it("ignores a blank saved name and Local mode's first name", () => {
    expect(displayNameFrom({ profile: { display_name: "  " } }, { first_name: "Local" })).toBe(
      DEFAULT_DISPLAY_NAME,
    );
    expect(displayNameFrom(undefined, { first_name: "local" })).toBe(DEFAULT_DISPLAY_NAME);
    expect(displayNameFrom(undefined, null)).toBe(DEFAULT_DISPLAY_NAME);
  });

  it("uses a real first name when nothing is saved", () => {
    expect(displayNameFrom(undefined, { first_name: "Ada", username: "ada" })).toBe("Ada");
  });
});

describe("initialsFrom", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFrom("Algo Trader")).toBe("AT");
    expect(initialsFrom("Carlito G")).toBe("CG");
    expect(initialsFrom("Ada")).toBe("A");
    expect(initialsFrom("  ")).toBe("?");
  });
});

describe("dashboardTitleFrom", () => {
  it("reads ui.dashboard_title and falls back to Condor", () => {
    expect(dashboardTitleFrom({ ui: { dashboard_title: "Night desk" } })).toBe("Night desk");
    expect(dashboardTitleFrom(undefined)).toBe("Condor");
    expect(dashboardTitleFrom({ ui: { dashboard_title: "  " } })).toBe("Condor");
  });
});
