# Mission Control — Development Reference

> Last updated after Phase 3. Use this document to re-orient at the start of each session.

---

## What it is

Mission Control is an Obsidian plugin that replaces the default new tab with a home-screen task and project dashboard. It reads tasks from a configurable folder, parses Obsidian Tasks emoji syntax and Dataview inline fields, and presents them in a Today / Upcoming / Projects layout without requiring either of those plugins to be installed.

The shell (new-tab interception, search bar, appearance settings, starred/recent file grids) is adapted from the abandoned [obsidian-home-tab](https://github.com/olrenso/obsidian-home-tab) plugin (MIT). Our attribution lives in `licenses/obsidian-home-tab-LICENSE`.

---

## Current functionality (Phases 1–3)

### Home tab shell
- **Replaces every new tab** with Mission Control (configurable; uses `iterateRootLeaves` to reliably catch all empty leaves)
- **Opens on startup** — if already open, focuses the existing leaf
- **Ribbon icon** (🏠) opens a new Mission Control tab from anywhere
- **Commands**: "Open new Mission Control tab" / "Replace current tab with Mission Control"
- **Appearance settings**: logo (default Obsidian, Lucide icon, image path, image URL, or none), wordmark text, font family/size/weight/color, logo scale, icon color, selection highlight colour — all lifted from home-tab with their full settings UI

### Omnisearch bar
- **Primary engine**: Omnisearch plugin (soft dependency — detected at runtime via `app.plugins.getPlugin('omnisearch')`)
- **Fallback**: Fuse.js fuzzy file-name search (built in, no extra install needed)
- **One-time notice** if Omnisearch isn't installed (fires once, stored in `data.json`)
- **Type/extension filters**: `markdown`, `image`, `pdf`, `canvas`, etc. (tab to activate, backspace to clear)
- Surfing (web browser) integration was **removed** — we don't need it

### Starred files grid & Recent files list
- Full functionality lifted from home-tab
- Each toggleable in settings
- Starred files = Obsidian bookmarks core plugin; graceful no-op if disabled

### Task dashboard
Rendered below the search bar in the standalone view. Not shown in embedded views.

#### Data layer (Obsidian-free, fully tested)
| File | Purpose |
|---|---|
| `src/tasks/Task.ts` | `Task` type — status, priority, dates, tags, project, source location |
| `src/tasks/dates.ts` | `getToday(dayStartHour)` with rollover; `addDaysISO`, `daysBetween`, `relativeLabel` |
| `src/tasks/TaskParser.ts` | `parseTaskLine` / `parseTasks` — emoji fields + Dataview inline fallback |
| `src/tasks/grouping.ts` | `buildDashboard` — buckets tasks into groups, builds project summaries |
| `src/tasks/recurrence.ts` | `computeNextDate` — 12 rule patterns (day/week/month/year/weekday + N-multiples) |
| `src/tasks/TaskWriter.ts` | `applyToggleToLine`, `buildNextRecurrence`, `toggleComplete` (vault write-back) |
| `src/tasks/TaskIndex.ts` | `Component` that watches the vault and pushes `Task[]` to a Svelte store |

#### Parsed task syntax
**Emoji fields** (Obsidian Tasks format):

| Emoji | Field |
|---|---|
| 📅 | due date |
| ⏳ | scheduled date |
| 🛫 | start date |
| ✅ | completion date |
| ➕ | created date |
| ⏫ | high priority |
| 🔺 | highest priority |
| 🔼 | low priority |
| 🔽 | lowest priority |
| ⏬ | lowest priority |
| 🔁 | recurrence rule |

**Dataview inline fields** (fallback): `[due:: 2026-06-01]`, `[priority:: high]`, `[scheduled:: 2026-06-01]`, `[completion:: 2026-06-01]`, `[repeat:: every week]`

**Tags**: `#foo`, `#foo/bar` — collected into `task.tags[]`, stripped from display text.

**Status chars**: `[ ]` open, `[x]` done, `[/]` in-progress, `[-]` cancelled.

#### Today pane
Groups (only shown if non-empty):
1. **Overdue** — due date < today, open tasks. Shows "Nd overdue" badge.
2. **Due today** — due date = today
3. **Scheduled today** — scheduled date = today (no due date conflict)
4. **In progress** — `[/]` status with no date

#### Upcoming pane (right column, stacked)
1. **Tomorrow**
2. **Next N days** — configurable window (default 7)
3. **Unscheduled** — open tasks with no 📅 or ⏳ date

#### Projects pane (right column, below Upcoming)
- One row per source file that has open tasks
- Shows open task count badge
- **Click project name** → filters both Today and Upcoming to that project only
- **↗ button** → opens the project note (Cmd/Ctrl+click → new tab)
- **"Clear project filter"** button appears when a filter is active

#### Task rows
Each row shows: checkbox button, display text, priority emoji, relative date / "Nd overdue", 🔁 badge if recurring, project pill.

- **Click the row** → opens source file, jumps to the correct line
- **Cmd/Ctrl+click** → opens in new tab
- **Click the checkbox** → toggles open ↔ done in the source file
  - Stamps `✅ YYYY-MM-DD` on completion
  - Strips `✅` date on re-opening
  - For recurring tasks: inserts a new open copy with the next due/scheduled date above the completed line
  - **Optimistic UI**: checkbox flips instantly, reverts via index update if the write fails

#### Recurrence rules supported
`every day` / `daily`, `every N days`, `every week` / `weekly`, `every N weeks`, `every month` / `monthly` (with Feb/short-month clamping), `every N months`, `every year` / `annually`, `every N years`, `every weekday` (Mon–Fri).

#### Mobile layout
Below 700px: Today / Upcoming / Projects become a tab strip (detected via `ResizeObserver`). All task rows have a 44px minimum height for touch targets.

---

## Settings reference

| Setting | Default | Notes |
|---|---|---|
| **Task source folder** | (vault root) | Dropdown of all vault folders. Scans recursively. Change triggers immediate re-index. |
| **Day starts at** | 4 (4am) | Slider 0–12. Tasks stay on "Today" until this hour so late-night work shows the right day. |
| **Upcoming window** | 7 days | Slider 1–30. How many days the "Next N days" group covers. |
| **Show completed tasks** | Off | Toggle. Includes `[x]` and `[-]` tasks in the dashboard. |
| **Replace new tabs** | On | Intercepts every new empty leaf. |
| **Open on startup** | On | Focuses existing MC tab or opens a new one. |
| **Close previous session tabs** | Off | Clears all other open leaves on startup. |
| **Use Omnisearch** | On (if installed) | Falls back to Fuse if off or Omnisearch missing. |
| **Show Omnisearch excerpt** | On | Shows matched text preview under results. |
| **Search results** | 5 | Slider 1–25. |
| **Search delay** | 0ms | Slider 0–500ms. |
| **Appearance** | (many) | Logo type/image/icon, wordmark, font, size, weight, color, selection highlight. |
| **Show starred files** | On (if Bookmarks enabled) | Grid of bookmarked vault files. |
| **Show recent files** | Off | List of recently opened files. Max count configurable. |

---

## File structure

```
src/
  main.ts                        # Plugin entry — loads, registers, wires everything
  homeView.ts                    # HomeTabView (FileView) — mounts Homepage.svelte
  homeTabSearchbar.ts            # Search bar state machine (Omnisearch vs Fuse)
  settings.ts                    # Settings interface, DEFAULT_SETTINGS, SettingTab UI
  store.ts                       # Svelte writable stores (settings, tasks, bookmarks, recent)
  recentFiles.ts                 # RecentFileManager component
  bookmarkedFiles.ts             # bookmarkedFilesManager component
  iconSelectionModal.ts          # Lucide icon picker for appearance settings
  obsidian-globals.d.ts          # Declares global `app: App`
  tasks/
    Task.ts                      # Task type + helpers
    dates.ts                     # Date utilities (dayStartHour rollover, ISO helpers)
    TaskParser.ts                # Line parser — emoji + Dataview fields
    grouping.ts                  # buildDashboard — buckets + sorting + project summaries
    TaskIndex.ts                 # Vault watcher → publishes Task[] to store
    TaskWriter.ts                # Checkbox toggle + recurrence next-instance write-back
    recurrence.ts                # computeNextDate — all supported rule patterns
  ui/
    homepage.svelte              # Root layout — logo, wordmark, search bar, dashboard
    searchBar.svelte             # Search input + filter pill + results dropdown
    bookmarkedFiles.svelte       # Starred files grid
    recentFiles.svelte           # Recent files list
    tasks/
      TaskDashboard.svelte       # Two-pane layout (Today + Upcoming/Projects); mobile tabs
      TaskItem.svelte            # Single task row with optimistic checkbox
    svelteComponents/            # (home-tab originals) file display items, suggestions, etc.
  suggester/
    omnisearchSuggester.ts       # Omnisearch API adapter
    homeTabSuggester.ts          # Fuse.js fallback
    fuzzySearch.ts               # Generic Fuse wrapper
    iconSuggester.ts             # For appearance settings
    imageSuggester.ts
    fontSuggester.ts
    suggester.ts                 # Abstract base
  utils/
    lucideIcons.ts               # Full Lucide icon name list (for appearance picker)
    getFileTypeUtils.ts          # Extension → file type mapping + filter keys
    getFilesUtils.ts             # Vault file helpers
    cssUnitValidator.ts
    fontValidator.ts
    htmlUtils.ts
    isLink.ts
    regexUtils.ts
scripts/
  logic-test.ts                  # 55 assertions covering parser, dates, grouping, writer, recurrence
```

---

## Known issues / rough edges to fix next

- **Diagnostic notices** are still in `main.ts` (steps 0–12, "MC fully loaded"). Strip before shipping.
- **`search-bar` code block** removed from main.ts but `EmbeddedHomeTab` class + parse logic still exists in `homeView.ts`. Either wire it back up properly or delete it.
- **`MarkdownView` import** in main.ts is now unused — the import was left in to keep `EmbeddedHomeTab` compiling.
- **CSS namespace**: internal classes are still `.home-tab-*` (from the original plugin). Renaming to `.mission-control-*` was deferred.
- **Checkbox write-back** uses `vault.getFileByPath()` (added in Obsidian 1.6.0). Confirmed safe given our `minAppVersion`.
- **Recurrence**: completion date is used as the "from" reference for computing the next occurrence. Some users prefer "from today" semantics (e.g. Tasks plugin offers both). Worth making configurable.
- **No quick-add**: there is no way to create a new task from the dashboard — you have to open the project file. Phase 4 planned a text input in the Today pane.
- **No inline edit**: clicking a row jumps to the source file. Planned but deferred; Obsidian's own editor is better than anything built inline.
- **Completed tasks linger in Today** until the vault watcher re-indexes the file (~50ms debounce). Optimistic UI hides the checkbox state immediately, but the row itself stays until the index updates.
- **BRAT releases**: releases must still be created manually on GitHub. Need `gh` CLI (install from https://cli.github.com/) for full automation.
- **`data.json` has stale settings**: `notifiedOmnisearchMissing: false` — notice will fire once on next load. Expected behaviour.

---

## Phase 4 — planned next

1. **Quick-add input** in the Today pane header — type a task, pick a project from a dropdown, press Enter. Appends a `- [ ] task text` line to the chosen project file.
2. **Ribbon icon opens/focuses** — already done ✓
3. **Vault symlink / dev script** — auto-deploy on build instead of manual copy (now done via `cp` in the build step; could be a watch script).
4. **Strip diagnostic notices** from `main.ts`.
5. **`gh` CLI release automation** — build → tag → create GitHub release with asset upload in one command.

---

## How to develop

```bash
cd /Users/andrewkfb/Code/obsidian-mission-control

# Build + deploy to vault in one step:
npm run build && cp main.js manifest.json \
  "/Users/andrewkfb/Documents/Foundry/.obsidian/plugins/mission-control/" && \
  cp src/styles.css \
  "/Users/andrewkfb/Documents/Foundry/.obsidian/plugins/mission-control/styles.css"

# Run logic tests (no Obsidian needed):
node -e "
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['scripts/logic-test.ts'],
  bundle: true, platform: 'node', format: 'cjs',
  outfile: 'scripts/.logic-test.cjs', logLevel: 'error',
}).then(() => { require('./scripts/.logic-test.cjs'); });
"

# Then in Obsidian: toggle plugin off → on (no restart needed)
```

Push to GitHub:
```bash
git add -A && git commit -m "your message" && git push
```

The vault is at `/Users/andrewkfb/Documents/Foundry/`. The plugin folder inside it is `.obsidian/plugins/mission-control/`.
