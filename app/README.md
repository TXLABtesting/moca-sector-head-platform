# منصة متابعة رئيس القطاع — Sector Chief Follow-up Platform

Production implementation (React + Vite + TypeScript) of the Claude Design prototype
in `../project/`. Arabic **RTL-first**, bilingual (AR ⇄ EN), light theme.

## Run

```bash
cd app
npm install
npm run dev      # http://localhost:5180
npm run build    # type-check + production build to dist/
```

## What's implemented

All ~10 screens from the prototype plus the cross-cutting systems:

- **App shell** — collapsible RTL sidebar (nested minutes under meetings, live badges),
  header (back, breadcrumb, global search, role switcher, AR/EN toggle), responsive drawer.
- **Chair dashboard** — 5 inline filter-tab cards (approvals / project updates / minutes /
  follow-ups / correspondence) with a dynamic executive list and contextual actions.
- **Member workspace** — per-person home + `workspace` layer: add/update items **inside each
  section**, save-as-draft / send-to-chair, returned-for-edit with reasons, change log.
- **Projects** — list (org-unit filter, board) + detail (header, tabs incl. a Gantt timeline,
  completion-approval + deadline-extension workflows, chair directives).
- **Meetings** — minutes (+ detail with attendees/absentees/decisions/actions),
  minute-tasks table (concise/detailed toggle, month navigator, pagination, drawer),
  requested meetings (Outlook-style calendar + table + propose-time).
- **Correspondence** — sortable table (صادر/وارد), add/edit modal, read-only doc detail + notes.
- **Committees** — KPIs, glass cards, detail tabs (summary / meetings & tasks / decisions with
  decree-scan previews / members & attendance).
- **Report Center** — hub + audit report, financial summary (entities / related parties / aging /
  bank interest), reports register, retention report.
- **Office tasks** — kanban / timeline / table + task drawer (deadline, directive, complete).
- **Team leaves** — KPI filters, conflict-aware timeline + table, side panel, substitute picker.
- **Permissions admin** — users, roles, 22×9 section-permission matrix, extra grants, change log,
  plus the "view platform as" role/person switcher in the header.
- **Executive assistant** — floating FAB + chat panel with a proactive briefing, quick actions,
  data-driven answers, and confirm-gated actions.

## Architecture

```
src/
  data/         seed.ts (real MOCA content, ported verbatim) + types.ts
  domain/       permissions (per-person grants) + workflow seed
  shared/       ported constants (icons, status colors) + bilingual dictionary + helpers
  i18n/         AR/EN context (t / tr / dl / dir)
  store/        zustand store (localStorage-persisted) + navigation + current user
  components/   Icon, Dropdown (portal), Badge/Avatar/Modal/Drawer/Card, Toast
  layout/       Shell, Sidebar, Header, Router
  screens/      one component per screen (+ member/ workflow layer)
```

- **State**: a single `window.__DATA`-equivalent store; team edits mutate the **same records**
  the chair sees, and all changes persist to `localStorage` (`moca.platform`).
- **Permissions**: 4 user types + per-person action grants; nav and in-screen actions gate on
  `can(user, section, action)`; the chair has full access and sole final-approval authority.
- **Styling**: inline styles ported from the prototype; the prototype's `--cXXXXXX` dark-mode
  vars resolve to their light-mode hex, so the port uses hex directly. Glass surfaces use `.glass`.

See `CONVENTIONS.md` for the porting contract used to build the screens.
