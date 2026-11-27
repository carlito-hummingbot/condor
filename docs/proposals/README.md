# Redesign proposal pages

One page per proposed UI change. They explain the rationale, show before and after, track review
status, and keep a log of refinements, so the team can see how a design changed and why.

## Format (so any agent or human can edit it)

- Plain HTML + one shared `styles.css`. No build step, no JavaScript, no generator. Open the file in
  any editor or browser.
- Screenshots are PNG files in `assets/`, referenced with relative paths.
- Each page has the same sections, in this order: Why, Before, After, Rollout, Open points from
  review, Decision requested, Refinement log.
- Status words in tables use a class on the cell: `s ok` (works), `s tweak` (works, needs a change),
  `s todo` (not seen or not done yet).

## Adding or changing a proposal

1. Copy an existing page (`side-rail.html` is the simplest) to `<topic>.html`.
2. Update the title, status line, PR list, and the sections. Keep claims to what you actually saw;
   put anything unchecked under "Not checked yet".
3. Add the page to the table in `index.html`.
4. Add a row at the top of the page's Refinement log: date, change, reason or source, PR.
5. If a choice is settled, add a row to the decisions log in `DESIGN.md` too, with the PR number.

## Screenshots

- Take them from the PR branch build, not from mock-ups. Name them by what they show
  (`rail-2-more-menu.png`, `onboarding-3-connect.png`).
- Show the "before" from the `ui-redesign` baseline.
- Phone views: render the app in a 390 px wide frame.
- Never include real balances, keys, addresses or server names. Use an empty or stub backend.

## Rules

- Frontend proposals only change layout and workflow unless a page says otherwise.
- Stacked PRs merge in order; say so on the page.
- Do not commit secrets, `conf/`, `state/` or machine-specific scripts.
