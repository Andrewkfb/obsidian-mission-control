<script lang="ts">
    import { Notice } from "obsidian"
    import { onMount, type ComponentType } from "svelte"
    import { tasks as tasksStore, pluginSettingsStore, noteTagsByPath } from "src/store"
    import { buildDashboard, type Dashboard, type ProjectSummary } from "src/tasks/grouping"
    import { getToday } from "src/tasks/dates"
    import { toggleComplete } from "src/tasks/TaskWriter"
    import type { Task } from "src/tasks/Task"
    import type HomeTab from "src/main"
    import TodayTab from "./tabs/TodayTab.svelte"
    import UpcomingTab from "./tabs/UpcomingTab.svelte"
    import ProjectsTab from "./tabs/ProjectsTab.svelte"
    import BookmarksTab from "./tabs/BookmarksTab.svelte"
    import RecentFilesTab from "./tabs/RecentFilesTab.svelte"
    import InboxTab from "./tabs/InboxTab.svelte"
    import TagFilterButton from "./TagFilterButton.svelte"

    export let plugin: HomeTab

    // Registry of dashboard tabs. To add a new tab:
    //   1. Create a component under ./tabs/.
    //   2. Add an entry here with its id, label, optional badge, and props.
    // The tab bar and pane both render from this array — no other code changes needed.
    type TabDef = {
        id: string
        label: string
        badge?: (d: Dashboard) => number
        component: ComponentType
        props: (ctx: TabContext) => Record<string, unknown>
        events?: (ctx: TabContext) => Record<string, (e: CustomEvent) => void>
    }
    type TabContext = {
        dashboard: Dashboard
        todayISO: string
        activeProject: string | null
    }

    const tabs: TabDef[] = [
        {
            id: "today",
            label: "Today",
            badge: (d) => d.today.reduce((n, g) => n + g.tasks.length, 0),
            component: TodayTab,
            props: (ctx) => ({ dashboard: ctx.dashboard, todayISO: ctx.todayISO, activeProject: ctx.activeProject }),
            events: () => ({
                toggle: (e) => handleToggle(e.detail.task),
                clearProject: () => (activeProject = null),
            }),
        },
        {
            id: "upcoming",
            label: "Upcoming",
            badge: (d) => d.upcoming.reduce((n, g) => n + g.tasks.length, 0),
            component: UpcomingTab,
            props: (ctx) => ({ dashboard: ctx.dashboard, todayISO: ctx.todayISO }),
            events: () => ({ toggle: (e) => handleToggle(e.detail.task) }),
        },
        {
            id: "projects",
            label: "Projects",
            component: ProjectsTab,
            props: (ctx) => ({ dashboard: ctx.dashboard, activeProject: ctx.activeProject }),
            events: () => ({ selectProject: (e) => selectProject(e.detail.project) }),
        },
        {
            id: "inbox",
            label: "Inbox",
            component: InboxTab,
            props: () => ({ app: plugin.app }),
        },
        {
            id: "bookmarks",
            label: "Bookmarks",
            component: BookmarksTab,
            props: () => ({ app: plugin.app, bookmarkedFileManager: plugin.bookmarkedFileManager }),
        },
        {
            id: "recent",
            label: "Recent",
            component: RecentFilesTab,
            props: () => ({ app: plugin.app, recentFileManager: plugin.recentFileManager }),
        },
    ]

    let activeTabId: string = tabs[0].id
    let activeProject: string | null = null
    let barEl: HTMLElement | null = null

    $: isbookmarksPluginEnabled = !!plugin.app.internalPlugins.getPluginById('bookmarks')
    $: enabledTabIds = $pluginSettingsStore?.activeTabs ?? ['today', 'upcoming', 'projects', 'bookmarks', 'recent']
    $: visibleTabs = tabs.filter(t => {
        if (!enabledTabIds.includes(t.id)) return false
        if (t.id === 'bookmarks' && (!isbookmarksPluginEnabled || !plugin.bookmarkedFileManager)) return false
        if (t.id === 'recent' && !plugin.recentFileManager) return false
        return true
    })
    $: if (visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTabId)) {
        activeTabId = visibleTabs[0].id
    }

    // After a tab switch, snap whatever ancestor is actually scrolling back to the
    // top of the tab bar. iOS opens the native <select> picker by scrolling the
    // page so the control is visible, and the scroll position isn't restored after
    // the picker closes — without this, switching tabs leaves the tabs (and tasks)
    // pushed off-screen behind the Obsidian mobile toolbar.
    function findScrollParent(el: HTMLElement | null): HTMLElement | null {
        let node: HTMLElement | null = el?.parentElement ?? null
        while (node) {
            const style = getComputedStyle(node)
            if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node
            node = node.parentElement
        }
        return null
    }
    function focusTabs() {
        // Defer to the next frame so the new tab content has rendered first.
        requestAnimationFrame(() => {
            if (!barEl) return
            const scroller = findScrollParent(barEl)
            if (scroller) {
                // Use bounding rects — offsetTop is relative to the nearest
                // positioned ancestor, which is rarely the scroll container.
                const barRect = barEl.getBoundingClientRect()
                const scrollerRect = scroller.getBoundingClientRect()
                scroller.scrollTop += barRect.top - scrollerRect.top
            } else {
                barEl.scrollIntoView({ block: "start" })
            }
        })
    }

    // On phones the header + search bar + bookmarked/recent panes push the
    // dashboard far below the fold. Auto-scroll to the tabs once mounted so
    // tasks are visible without manual scrolling.
    onMount(() => {
        if (window.matchMedia("(max-width: 600px)").matches) {
            // Two frames: one for layout, one for any settled adjustments.
            requestAnimationFrame(() => requestAnimationFrame(focusTabs))
        }
    })

    $: todayISO = $pluginSettingsStore ? getToday($pluginSettingsStore.dayStartHour) : ""
    $: allowedTagWhitelist = $pluginSettingsStore?.allowedFilterTags ?? []
    $: activeFilterTags = $pluginSettingsStore?.activeFilterTags ?? []

    // Tags shown in the filter menu = whitelist if set, otherwise every tag we've indexed.
    $: indexedTags = (() => {
        const all = new Set<string>()
        for (const tags of ($noteTagsByPath ?? new Map<string, Set<string>>()).values()) {
            for (const t of tags) all.add(t)
        }
        return [...all].sort((a, b) => a.localeCompare(b))
    })()
    $: menuTags = allowedTagWhitelist.length > 0
        ? indexedTags.filter(t => allowedTagWhitelist.includes(t))
        : indexedTags

    // Filter pipeline: project filter, then tag filter, then bucket.
    $: tagFilterActive = activeFilterTags.length > 0
    $: allTasks = ($tasksStore ?? []).filter((t) => {
        if (activeProject && t.sourcePath !== activeProject) return false
        if (tagFilterActive) {
            const noteTags = $noteTagsByPath?.get(t.sourcePath)
            if (!noteTags) return false
            // OR semantics: pass if the note has any of the selected tags.
            for (const tag of activeFilterTags) if (noteTags.has(tag)) return true
            return false
        }
        return true
    })
    $: dashboard = buildDashboard(allTasks, todayISO, {
        upcomingDays: $pluginSettingsStore?.upcomingDays ?? 7,
        showCompleted: $pluginSettingsStore?.showCompletedTasks ?? false,
    })
    $: ctx = { dashboard, todayISO, activeProject } as TabContext
    $: activeTab = visibleTabs.find((t) => t.id === activeTabId) ?? visibleTabs[0]

    async function handleToggle(task: Task) {
        try {
            await toggleComplete(task, app.vault, todayISO)
        } catch (e) {
            new Notice(`Mission Control: could not update task — ${(e as Error).message}`)
            console.error(e)
        }
    }

    function selectProject(p: ProjectSummary) {
        activeProject = activeProject === p.sourcePath ? null : p.sourcePath
        if (activeProject && visibleTabs.some(t => t.id === 'today')) activeTabId = 'today'
    }

    function setActiveTags(tags: string[]) {
        plugin.settings.activeFilterTags = tags
        plugin.saveSettings()
    }
</script>

<div class="mc-dashboard">
    <div class="mc-bar" bind:this={barEl}>
        <!-- Wide viewports: button row. Narrow viewports: native select. CSS swaps them. -->
        <div class="mc-tabbar">
            {#each visibleTabs as tab (tab.id)}
                {@const count = tab.badge?.(dashboard) ?? 0}
                <button class:mc-active={activeTabId === tab.id} on:click={() => { activeTabId = tab.id; focusTabs() }}>
                    {tab.label}{count ? ` (${count})` : ""}
                </button>
            {/each}
        </div>
        <select class="mc-tabselect" bind:value={activeTabId} on:change={focusTabs} aria-label="Active tab">
            {#each visibleTabs as tab (tab.id)}
                {@const count = tab.badge?.(dashboard) ?? 0}
                <option value={tab.id}>{tab.label}{count ? ` (${count})` : ""}</option>
            {/each}
        </select>
        <TagFilterButton
            availableTags={menuTags}
            activeTags={activeFilterTags}
            on:change={(e) => setActiveTags(e.detail.tags)}
        />
    </div>

    {#if visibleTabs.length === 0}
        <p class="mc-empty">All tabs are hidden. Enable at least one tab in settings.</p>
    {:else}
        <svelte:component
            this={activeTab.component}
            {...activeTab.props(ctx)}
            on:toggle={activeTab.events?.(ctx).toggle}
            on:clearProject={activeTab.events?.(ctx).clearProject}
            on:selectProject={activeTab.events?.(ctx).selectProject}
        />
    {/if}
</div>

<style>
    .mc-dashboard {
        margin-top: 24px;
        width: 100%;
        max-width: 100%;
        /* Belt-and-braces against horizontal overflow on narrow viewports. */
        overflow-x: hidden;
        box-sizing: border-box;
    }
    .mc-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
    }
    .mc-tabbar {
        display: flex;
        gap: 4px;
        flex: 1 1 auto;
        min-width: 0;
    }
    .mc-tabbar button {
        flex: 1 1 0;
        min-width: 0;
        padding: 10px 6px;
        min-height: 44px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .mc-tabbar button.mc-active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }
    /* Native select used on narrow viewports — hidden on desktop. */
    .mc-tabselect {
        display: none;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 44px;
        padding: 8px 10px;
        font: inherit;
        background: var(--background-modifier-form-field);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
    }
    @media (max-width: 600px) {
        .mc-tabbar { display: none; }
        .mc-tabselect { display: block; }
    }
    :global(.mc-pane-title) {
        font-size: 1.2em;
        margin: 0 0 8px 0;
        border-bottom: 1px solid var(--background-modifier-border);
        padding-bottom: 4px;
    }
    :global(.mc-group) { margin-bottom: 16px; }
    :global(.mc-group-title) {
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin: 8px 0 4px 0;
    }
    :global(.mc-count) {
        color: var(--text-faint);
        font-weight: normal;
    }
    :global(.mc-empty) {
        color: var(--text-muted);
        font-style: italic;
    }
    :global(.mc-project-row) {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
    }
    :global(.mc-project-name) {
        flex: 1 1 auto;
        text-align: left;
        background: none;
        box-shadow: none;
        padding: 6px 4px;
        min-height: 44px;
    }
    :global(.mc-project-count) {
        flex: 0 0 auto;
        font-size: 0.8em;
        color: var(--text-muted);
        background: var(--background-modifier-hover);
        border-radius: 10px;
        padding: 1px 8px;
    }
    :global(.mc-project-open) {
        flex: 0 0 auto;
        background: none;
        box-shadow: none;
        padding: 4px 8px;
    }
    :global(.mc-clear-filter) {
        margin-bottom: 8px;
        font-size: 0.8em;
    }
</style>
