import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeysReminderBanner } from "@/components/KeysReminderBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { RelaunchBanner } from "@/components/RelaunchBanner";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";
import { TelemetryConsentBanner } from "@/components/TelemetryConsentBanner";
import { ChatProvider } from "@/hooks/useChat";
import { useApplySavedAppearance, useDashboardTitle } from "@/hooks/useUserPreferences";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePrefetchData } from "@/hooks/usePrefetchData";
import { useServer } from "@/hooks/useServer";
import { FULL_BLEED_ROUTES } from "@/lib/nav";
import { routeFacts } from "@/lib/pageFacts";
import { useViewFacts } from "@/lib/viewFacts";
import { MobileTabBar } from "./MobileTabBar";
import { ShellControls } from "./ShellControls";
import { SideRail } from "./SideRail";

/**
 * Full-bleed routes that carry a parameter, so an exact match cannot find them.
 *
 * The Lab (`/agents/:slug/runs`, FEAT-099) was the first: a rail, a tick spine
 * and a body, all screen-tall, under a slug the shell cannot enumerate. The
 * agent workspace absorbed it (FEAT-103) and is the same shape in every view —
 * a header, a loop bar, a spine and a body, each scrolling on its own — so the
 * Lab's pattern is replaced by an exact match on the one route. Kept as a
 * separate pattern list rather than turned into a `startsWith` over the array
 * above, because `/` is in that array and prefixes everything.
 */
const FULL_BLEED_PATTERNS = [/^\/agents\/[^/]+$/];

/**
 * The shell owns the chat state.
 *
 * There used to be two surfaces rendering a conversation — an overlay panel
 * docked to the right of every page, and the workspace at `/` — which meant
 * two doors to one thing. The panel is gone; the provider stays here so the
 * socket outlives navigation between pages and the workspace.
 */
export function AppShell() {
  return (
    <ChatProvider>
      <AppShellBody />
    </ChatProvider>
  );
}

function AppShellBody() {
  const { server } = useServer();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  useDashboardTitle();
  useApplySavedAppearance();
  const { showWizard, showKeysBanner } = useOnboarding();
  const [reportOpen, setReportOpen] = useState(false);

  // A pathname is enough: every full-bleed screen is its own route.
  // `/agents/:slug` is an ordinary padded page, deliberately not matched here.
  const isFullBleed =
    FULL_BLEED_ROUTES.includes(pathname) ||
    FULL_BLEED_PATTERNS.some((re) => re.test(pathname));

  // ⌘K used to toggle the overlay panel. It now goes to the chat, so the
  // reflex still lands somewhere sensible instead of silently doing nothing.
  // The keystroke means a *conversation*, and the home is one again.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        navigate("/chat");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  // Prefetch core data (executors, bots) and subscribe to WS channels early
  usePrefetchData();

  // The route baseline for the chat's page context (FEAT-059): every page
  // gets a label and a URL-derived subject through the same seam richer
  // contributors use, so the chat never has to know about the router.
  // The client is handed over so the table can also read what each page is
  // rendering (FEAT-060) — at send time, out of the cache the page fetched
  // through, rather than from eight components each pushing their state here.
  const queryClient = useQueryClient();
  useViewFacts(() => routeFacts(pathname, search, queryClient));

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* The rail replaces the 48px top bar. The onboarding wizard mounts in
          `main`, so the rail stays visible and usable beside it. */}
      <SideRail onReport={() => setReportOpen(true)} />
      {/* `min-h-0` so a long padded page scrolls inside the screen on a phone: a flex
          column otherwise grows to its content and the page scrolls the whole shell. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Server, Gateway status and Switch Mode (light/dark). */}
        <ShellControls />

        {/* An update landed but this process is still the old one, so the bundle
            in the browser is ahead of the API answering it. Above `main` for the
            same reason the consent strip is: every page needs it, and the chat
            workspace owns its own scrolling. Renders nothing the rest of the
            time, which is nearly always. */}
        <RelaunchBanner />

        {/* Asks once, for an install that has never answered (FEAT-023). Hidden
            during first-run setup so a new user is not asked twice. */}
        {!showWizard && <TelemetryConsentBanner />}

        {/* Non-blocking: the page underneath stays usable. The wizard, while it
            is open, is the prompt instead. */}
        {showKeysBanner && <KeysReminderBanner />}

        {/* Main content. The scroller is the inner div so the wizard, which is
            positioned against `main`, stays put when the page is long. */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <div
            className={`relative min-h-0 flex-1 ${
              isFullBleed ? "overflow-hidden" : "overflow-auto p-6"
            }`}
          >
            <ErrorBoundary resetKey={pathname + server}>
              <Outlet key={server} />
            </ErrorBoundary>
          </div>
          {showWizard && <OnboardingWizard />}
        </main>
      </div>

      <MobileTabBar onReport={() => setReportOpen(true)} />

      <ReportIssueDialog open={reportOpen} onClose={() => setReportOpen(false)} />

      {/* The quick chat on every page but `/` (FEAT-059). Hidden during
          setup so it does not sit on top of the wizard. */}
      {!showWizard && <ChatBubble />}
    </div>
  );
}
