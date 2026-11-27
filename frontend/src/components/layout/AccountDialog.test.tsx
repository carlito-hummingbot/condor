/**
 * The "Your account" dialog: name and Dashboard title.
 *
 * It must edit the same record, with the same limits, as the onboarding step,
 * so the PATCH body and the field rules are checked here as well as the
 * behaviour of the modal.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplayName, useDashboardTitle } from "@/hooks/useDisplayName";

type Prefs = {
  profile?: { display_name?: string };
  ui?: { dashboard_title?: string; theme?: string };
};

const { updatePreferences, getPreferences } = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
  getPreferences: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { getPreferences, updatePreferences } }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    token: "t",
    user: { id: 1, username: "local", first_name: "Local", role: "admin" },
    logout: () => {},
  }),
}));

const { AccountDialog } = await import("./AccountDialog");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let saved: Prefs;

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** The dialog next to the things that must change when it saves. */
function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const name = useDisplayName();
  const title = useDashboardTitle();
  return (
    <div>
      <button id="opener" onClick={() => setOpen(true)}>
        Open
      </button>
      <span data-testid="name">{name}</span>
      <span data-testid="title">{title}</span>
      <AccountDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      />
    </div>
  );
}

function render(ui = <Harness />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
}

const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement | null;
const field = (label: string) =>
  [...document.body.querySelectorAll("label")]
    .find((l) => l.textContent === label)
    ?.control as HTMLInputElement;
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement;

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function openIt() {
  const opener = document.getElementById("opener") as HTMLButtonElement;
  opener.focus();
  await act(async () => {
    opener.click();
  });
  await flush();
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  saved = { profile: { display_name: "Algo Trader" }, ui: { dashboard_title: "Desk One", theme: "dark" } };
  getPreferences.mockImplementation(async () => saved);
  updatePreferences.mockReset();
  updatePreferences.mockImplementation(async (updates: Record<string, unknown>) => {
    saved = { ...saved, ...updates } as Prefs;
    return saved;
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AccountDialog", () => {
  it("is an accessible modal that opens on the current name and title", async () => {
    render();
    await flush();
    expect(dialog()).toBeNull();
    await openIt();

    const d = dialog()!;
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.getAttribute("aria-labelledby")).toBeTruthy();
    expect(document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent).toBe(
      "Your account",
    );
    expect(field("What should we call you?").value).toBe("Algo Trader");
    expect(field("Dashboard title").value).toBe("Desk One");
    // Same limits as the onboarding step.
    expect(field("What should we call you?").maxLength).toBe(80);
    expect(field("Dashboard title").maxLength).toBe(40);
    expect(field("Dashboard title").placeholder).toBe("Condor");
    // Focus lands on the first field.
    expect(document.activeElement).toBe(field("What should we call you?"));
  });

  it("keeps Save off until something changed, and off for an empty name", async () => {
    render();
    await flush();
    await openIt();
    expect(button("Save").disabled).toBe(true);

    await type(field("Dashboard title"), "Desk Two");
    expect(button("Save").disabled).toBe(false);

    await type(field("What should we call you?"), "   ");
    expect(button("Save").disabled).toBe(true);
    expect(dialog()?.textContent).toContain("Tell us what to call you.");
    expect(updatePreferences).not.toHaveBeenCalled();

    await type(field("What should we call you?"), "Algo Trader");
    await type(field("Dashboard title"), "Desk One");
    expect(button("Save").disabled).toBe(true);
  });

  it("saves the same keys and shape the wizard writes, then updates the app and closes", async () => {
    render();
    await flush();
    expect(document.querySelector('[data-testid="name"]')?.textContent).toBe("Algo Trader");
    await openIt();

    await type(field("What should we call you?"), "  Sofi  ");
    await type(field("Dashboard title"), "  Sofi's Desk  ");
    await act(async () => {
      button("Save").click();
    });
    await flush();

    // Whole `profile` and `ui` keys; the untouched `theme` rides along.
    expect(updatePreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({
      profile: { display_name: "Sofi" },
      ui: { dashboard_title: "Sofi's Desk", theme: "dark" },
    });
    // The cache took the response: the app shows the new values at once.
    expect(document.querySelector('[data-testid="name"]')?.textContent).toBe("Sofi");
    expect(document.querySelector('[data-testid="title"]')?.textContent).toBe("Sofi's Desk");
    expect(dialog()?.textContent).toContain("Saved.");

    await flush(800);
    expect(dialog()).toBeNull();
  });

  it("clears the title back to Condor when the field is emptied", async () => {
    render();
    await flush();
    await openIt();
    await type(field("Dashboard title"), "");
    await act(async () => {
      button("Save").click();
    });
    await flush();
    expect(updatePreferences).toHaveBeenCalledWith({
      profile: { display_name: "Algo Trader" },
      ui: { theme: "dark" },
    });
    expect(document.querySelector('[data-testid="title"]')?.textContent).toBe("Condor");
    await flush(800);
  });

  it("shows an error and stays open when the save fails", async () => {
    updatePreferences.mockRejectedValueOnce(new Error("boom"));
    render();
    await flush();
    await openIt();
    await type(field("Dashboard title"), "Desk Two");
    await act(async () => {
      button("Save").click();
    });
    await flush();
    expect(dialog()?.textContent).toContain("Could not save.");
    expect(dialog()?.textContent).not.toContain("Saved.");
    expect(document.querySelector('[data-testid="title"]')?.textContent).toBe("Desk One");
    // Still editable, and a retry goes through.
    expect(button("Save").disabled).toBe(false);
  });

  it("closes on Cancel without saving, and returns focus to the opener", async () => {
    render();
    await flush();
    await openIt();
    await type(field("Dashboard title"), "Desk Two");
    await act(async () => {
      button("Cancel").click();
    });
    await flush();
    expect(dialog()).toBeNull();
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById("opener"));
  });

  it("closes on Escape without saving, and a reopened dialog starts from the saved values", async () => {
    render();
    await flush();
    await openIt();
    await type(field("What should we call you?"), "Someone Else");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await flush();
    expect(dialog()).toBeNull();
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById("opener"));

    await openIt();
    expect(field("What should we call you?").value).toBe("Algo Trader");
  });

  it("closes on a click on the backdrop but not inside the dialog", async () => {
    render();
    await flush();
    await openIt();
    await act(async () => {
      dialog()!.click();
    });
    expect(dialog()).not.toBeNull();
    await act(async () => {
      (dialog()!.parentElement as HTMLElement).click();
    });
    expect(dialog()).toBeNull();
  });

  it("keeps Tab inside the dialog", async () => {
    render();
    await flush();
    await openIt();
    const name = field("What should we call you?");
    await type(field("Dashboard title"), "Desk Two"); // enables Save, so it is the last stop
    const save = button("Save");

    save.focus();
    await act(async () => {
      dialog()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(name);

    await act(async () => {
      dialog()!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(save);
  });
});
