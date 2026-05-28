# Mission Control

A home-tab task and project dashboard for [Obsidian](https://obsidian.md/), sourced from a single configurable folder.

> Status: **Phase 1 — scaffolding.** The task-management UI is not built yet. This repo currently has the home-tab base (search bar, starred grid, recent files, appearance controls) renamed and rewired for Mission Control. The Today/Upcoming/Projects panes are planned for Phase 2.

## What it will do

- **Today view** — overdue, due today, scheduled today, and in-progress tasks pulled from your chosen folder
- **Upcoming sidebar** — tomorrow, next 7 days, unscheduled, and a project list (one file per project)
- **Omnisearch-powered search bar** at the top of the page, with a fuzzy fallback if Omnisearch isn't installed
- **Compatible with existing syntax** — [Obsidian Tasks](https://publish.obsidian.md/tasks) emoji fields and [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) inline fields, both read without requiring those plugins
- **Customisable header** — logo (Lucide icon, image, or default), wordmark, font, colors
- **Mobile-friendly** — works on iOS/Android with a responsive layout

## Commands

- `Mission Control: Open new Mission Control tab`
- `Mission Control: Replace current tab with Mission Control`

## Credits

The home-tab shell — new-tab interception, search bar UI, appearance settings, Lucide icon picker, starred-file grid, and recent-files list — is adapted from [obsidian-home-tab](https://github.com/olrenso/obsidian-home-tab) by Lorenzo (olrenso), used under the MIT License. The original license is preserved at [licenses/obsidian-home-tab-LICENSE](licenses/obsidian-home-tab-LICENSE).
