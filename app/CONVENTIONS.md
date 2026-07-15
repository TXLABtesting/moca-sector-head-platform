# Porting conventions — Sector Chief Platform (React + Vite + TS)

You are porting a screen from an Arabic **RTL** government dashboard prototype
(`../project/*.dc.html`) into this React app. Recreate the visual output
**pixel-for-pixel**. The prototype is HTML/CSS/JS using a custom template runtime
(`{{ }}` holes, `sc-if`, `sc-for`, `dc-import`). Port the **template + its `<script>` logic**
into an idiomatic React component. Match layout, spacing, colors, fonts, and behavior.

## Golden rules
- **Light mode only.** The prototype's `var(--cXXXXXX, #hex)` were dark-mode overrides that
  fall back to their hex in light mode. So **replace every `var(--cXXXXXX,#hex)` with just `#hex`.**
- **RTL-first.** Use logical CSS props (`insetInlineStart`, `marginInlineStart`, `paddingInlineStart`,
  `borderInlineStart`, `textAlign:'start'`). Never hardcode left/right for RTL-sensitive layout.
- Inline styles are fine (the prototype uses them). Keep them.
- Arabic strings stay Arabic. For bilingual labels use the i18n helpers below.
- **Do NOT edit shared files** (`src/store/*`, `src/data/*`, `src/domain/*`, `src/i18n/*`,
  `src/shared/*`, `src/components/*`, `src/layout/*`). Only create/edit files under `src/screens/`
  (and, if needed, a screen-specific subfolder `src/screens/<name>/`). If you need a store
  mutation, use the generic `mutate`/`log` actions (below) — do not add new store methods.
- Your screen file must make `npx tsc -b --noEmit` pass. Prefer `any` casts on ported data over
  fighting types, but keep it readable.

## Data
- `import { useStore } from '../store/store'` → `const data = useStore(s => s.data)` gives `AppData`
  (see `src/data/types.ts`). Collections: `members, sectorManagers, leaves, projects, meetings,
  actions, audit, mtasks, correspondence, otasks, regReports, finModel, reqMeetings, committees`.
  The real content is verbatim from the prototype; **never fabricate data**.
- To mutate (persisted to localStorage): `const mutate = useStore(s => s.mutate)` then
  `mutate(d => { d.projects.find(p=>p.id===id).status = 'مكتمل'; })`. Mutations replace the object
  immutably, so components re-render.
- Change log (optional): `const log = useStore(s => s.log); log({ by, byName, section, item, from, to, note })`.
- To append transient workflow flags to a record (e.g. `_mrev`, `_mret`, `directives`), just set them
  inside `mutate`; records are plain objects.

## i18n & direction
- `import { useI18n } from '../i18n/i18n'` → `const { lang, dir, t, tr, dl } = useI18n()`.
  - `lang` is `'ar' | 'en'`; `dir` is `'rtl' | 'ltr'`.
  - `t('key')` → UITEXT label for the current lang (keys are the prototype's `t.*` names, e.g.
    `t('ot_title')`). If a key is missing it returns the key.
  - `tr('arabic string')` → English translation when `lang==='en'`, else the Arabic (DICT lookup).
    Use for **data values** (statuses, names, types) that the prototype passed through `tr()`/`statusLabel`.
  - `dl('5 يوليو 2026')` → localizes Arabic month names to English when `lang==='en'`.
  - Convenience: `const rl = (a,b)=> lang==='en'?b:a;` for inline bilingual literals (prototype's `rl`).

## Permissions
- `import { useCurrentUser } from '../store/useCurrentUser'` → `const cu = useCurrentUser()`.
- `import { can, canSee } from '../domain/permissions'` → `can(cu, 'projects', 'approve')`,
  `canSee(cu, 'projects')`. Chair (`cu.type==='chair'`) can do everything.
- The prototype passed booleans like `can-approve`, `can-edit`, `can-note` as props; compute them here
  with `can(cu, <section>, <action>)`. Actions: view/add/edit/del/attach/status/review/note/approve.

## Navigation
- `import { useNav } from '../store/nav'` → `const { page, params, goto, back } = useNav()`.
  - `page` is the current route; detail screens read ids from `params` (e.g. `params.selProject`).
  - `goto('projectDetail', { selProject: id })` to open a detail; `back()` to return.
  - Page keys: dashboard, team, projects, projectDetail, meetings, meetingDetail, mtasks, actions,
    reqmeetings, correspondence, docDetail, committees, reportcenter, reportDetail, auditDetail,
    finDetail, reglog, otasks, leaves, workspace, settings.

## Shared UI primitives (import from '../components/...')
- `Icon` (`../components/Icon`): `<Icon name="folder" size={19} />` — names are keys of the shared
  `ICN` registry (home, team, folder, calendar, task, mail, chart, settings, timer, scale, tick,
  note, bank, list, pin, send, receive, crown, shield). For one-off SVGs used only in your screen,
  just write the `<svg>` inline (copy from the prototype).
- `ui` (`../components/ui`): `Fade` (page fade wrapper), `Card` (glass surface card),
  `Badge({bg,fg})`, `Avatar({name,size,img})` (photo if known else colored initials),
  `Modal({open,onClose,width})` (dimmed backdrop + white card), `Drawer({open,onClose,width})`
  (side panel), `statusPair(map,key)`.
- `Dropdown` (`../components/Dropdown`): `<Dropdown value={v} options={[{v,label}]} onChange={fn}
  opt={{size:'sm',block:true,placeholder}} />` — matches the prototype's renderDD (portal popup).
- `useToast` (`../components/Toast`): `const { showToast } = useToast(); showToast('...')`.

## Status color maps (import from '../shared/constants')
`PS` (project statuses), `CS` (correspondence), `AS` (actions), `PR` (priority, `[bg,fg,dot]`),
`ACCENT` (status→accent color), `AV` (avatar palettes), `WFS`-equivalent is in
`../domain/permissions` as `WFS`. Each is `[bg, fg]` (already hex). Example:
`const [bg,fg] = (PS as any)[status] || ['#eceeeb','#6d7973'];`

## Helpers (import from '../shared/helpers')
`initials(name)`, `memberImg(name)` (returns '/assets/team/x.jpg' or ''), `asset(path)`
(prefixes '/'), `parseAr('5 يوليو 2026')→Date`, `parseProposed`, `ymdKey`, `timeLabel`,
`timeRange`, `arPlural`, `outlookUrl`, `pad2`. Committee decision images use `asset('assets/dec_x.png')`.

## Component shape
Export a named function component matching the stub already in `src/screens/<Name>.tsx`
(e.g. `export function Projects() {...}`). It handles all of its sub-pages internally by reading
`page`/`params` from `useNav` (e.g. Projects renders the list on `page==='projects'` and the detail on
`page==='projectDetail'`). Wrap top-level content in `<Fade>`.

## Glass cards
Main-content cards that were solid white in the prototype should use the `Card` component or add
`className="glass"` to get the translucent frosted look. Modals/drawers/dropdowns stay opaque white.
