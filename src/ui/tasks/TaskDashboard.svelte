<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Notice, TFile } from "obsidian"
    import { tasks as tasksStore, pluginSettingsStore } from "src/store"
    import { buildDashboard, type ProjectSummary } from "src/tasks/grouping"
    import { getToday } from "src/tasks/dates"
    import { toggleComplete } from "src/tasks/TaskWriter"
    import type { Task } from "src/tasks/Task"
    import TaskItem from "./TaskItem.svelte"

    let activeProject: string | null = null

    // Mobile: collapse the two-pane layout into a tab switcher below this width.
    let container: HTMLElement
    let narrow = false
    let mobileTab: "today" | "upcoming" | "projects" = "today"
    let resizeObserver: ResizeObserver

    // Reactive pipeline: settings + tasks + active filter -> dashboard.
    $: todayISO = $pluginSettingsStore ? getToday($pluginSettingsStore.dayStartHour) : ""
    $: allTasks = ($tasksStore ?? []).filter((t) => !activeProject || t.sourcePath === activeProject)
    $: dashboard = buildDashboard(allTasks, todayISO, {
        upcomingDays: $pluginSettingsStore?.upcomingDays ?? 7,
        showCompleted: $pluginSettingsStore?.showCompletedTasks ?? false,
    })
    $: totalToday = dashboard.today.reduce((n, g) => n + g.tasks.length, 0)

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
    }

    function openProject(p: ProjectSummary, newTab: boolean) {
        const file = app.vault.getAbstractFileByPath(p.sourcePath)
        if (file instanceof TFile) app.workspace.getLeaf(newTab).openFile(file)
    }

    onMount(() => {
        resizeObserver = new ResizeObserver((entries) => {
            narrow = entries[0].contentRect.width < 700
        })
        resizeObserver.observe(container)
    })
    onDestroy(() => {
        resizeObserver?.disconnect()
    })
</script>

<div class="mc-dashboard" bind:this={container} class:mc-narrow={narrow}>
    {#if narrow}
        <div class="mc-tabbar">
            <button class:mc-active={mobileTab === "today"} on:click={() => (mobileTab = "today")}>
                Today {totalToday ? `(${totalToday})` : ""}
            </button>
            <button class:mc-active={mobileTab === "upcoming"} on:click={() => (mobileTab = "upcoming")}>
                Upcoming
            </button>
            <button class:mc-active={mobileTab === "projects"} on:click={() => (mobileTab = "projects")}>
                Projects
            </button>
        </div>
    {/if}

    <div class="mc-panes">
        {#if !narrow || mobileTab === "today"}
            <section class="mc-pane mc-today">
                <h2 class="mc-pane-title">Today</h2>
                {#if activeProject}
                    <button class="mc-clear-filter" on:click={() => (activeProject = null)}>
                        Clear project filter
                    </button>
                {/if}
                {#if dashboard.today.length === 0}
                    <p class="mc-empty">Nothing due. 🎉</p>
                {:else}
                    {#each dashboard.today as group (group.key)}
                        <div class="mc-group">
                            <h3 class="mc-group-title">{group.title} <span class="mc-count">{group.tasks.length}</span></h3>
                            {#each group.tasks as task (task.sourcePath + ":" + task.sourceLine)}
                                <TaskItem {task} {todayISO} on:toggle={(e) => handleToggle(e.detail.task)} />
                            {/each}
                        </div>
                    {/each}
                {/if}
            </section>
        {/if}

        {#if !narrow || mobileTab === "upcoming"}
            <section class="mc-pane mc-upcoming">
                <h2 class="mc-pane-title">Upcoming</h2>
                {#if dashboard.upcoming.length === 0}
                    <p class="mc-empty">Nothing on the horizon.</p>
                {:else}
                    {#each dashboard.upcoming as group (group.key)}
                        <div class="mc-group">
                            <h3 class="mc-group-title">{group.title} <span class="mc-count">{group.tasks.length}</span></h3>
                            {#each group.tasks as task (task.sourcePath + ":" + task.sourceLine)}
                                <TaskItem {task} {todayISO} on:toggle={(e) => handleToggle(e.detail.task)} />
                            {/each}
                        </div>
                    {/each}
                {/if}
            </section>
        {/if}

        {#if !narrow || mobileTab === "projects"}
            <section class="mc-pane mc-projects">
                <h2 class="mc-pane-title">Projects</h2>
                {#if dashboard.projects.length === 0}
                    <p class="mc-empty">No projects with open tasks.</p>
                {:else}
                    {#each dashboard.projects as p (p.sourcePath)}
                        <div class="mc-project-row" class:mc-selected={activeProject === p.sourcePath}>
                            <button class="mc-project-name" on:click={() => selectProject(p)} title="Filter dashboard to this project">
                                {p.project}
                            </button>
                            <span class="mc-project-count">{p.openCount}</span>
                            <button class="mc-project-open" on:click={(e) => openProject(p, e.ctrlKey || e.metaKey)} aria-label="Open project note">↗</button>
                        </div>
                    {/each}
                {/if}
            </section>
        {/if}
    </div>
</div>

<style>
    .mc-dashboard {
        margin-top: 24px;
        width: 100%;
    }
    .mc-panes {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        align-items: start;
    }
    .mc-narrow .mc-panes {
        grid-template-columns: 1fr;
    }
    /* On wide layouts, Upcoming and Projects share the right column stacked. */
    .mc-upcoming, .mc-projects {
        grid-column: 2;
    }
    .mc-today {
        grid-column: 1;
        grid-row: 1 / span 2;
    }
    .mc-narrow .mc-today,
    .mc-narrow .mc-upcoming,
    .mc-narrow .mc-projects {
        grid-column: 1;
        grid-row: auto;
    }
    .mc-pane-title {
        font-size: 1.2em;
        margin: 0 0 8px 0;
        border-bottom: 1px solid var(--background-modifier-border);
        padding-bottom: 4px;
    }
    .mc-group { margin-bottom: 16px; }
    .mc-group-title {
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin: 8px 0 4px 0;
    }
    .mc-count {
        color: var(--text-faint);
        font-weight: normal;
    }
    .mc-empty {
        color: var(--text-muted);
        font-style: italic;
    }
    .mc-tabbar {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
    }
    .mc-tabbar button {
        flex: 1;
        padding: 10px;
        min-height: 44px;
    }
    .mc-tabbar button.mc-active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }
    .mc-project-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
    }
    .mc-project-row.mc-selected .mc-project-name {
        color: var(--text-accent);
        font-weight: 600;
    }
    .mc-project-name {
        flex: 1 1 auto;
        text-align: left;
        background: none;
        box-shadow: none;
        padding: 6px 4px;
        min-height: 44px;
    }
    .mc-project-count {
        flex: 0 0 auto;
        font-size: 0.8em;
        color: var(--text-muted);
        background: var(--background-modifier-hover);
        border-radius: 10px;
        padding: 1px 8px;
    }
    .mc-project-open {
        flex: 0 0 auto;
        background: none;
        box-shadow: none;
        padding: 4px 8px;
    }
    .mc-clear-filter {
        margin-bottom: 8px;
        font-size: 0.8em;
    }
</style>
