<script lang="ts">
    import type { Dashboard } from "src/tasks/grouping"
    import type { Task } from "src/tasks/Task"
    import { relativeLabel } from "src/tasks/dates"
    import TaskItem from "../TaskItem.svelte"
    import { createEventDispatcher } from "svelte"
    import type { App } from "obsidian"

    export let app: App
    export let dashboard: Dashboard
    export let todayISO: string

    const dispatch = createEventDispatcher<{ toggle: { task: Task } }>()
</script>

<section class="mc-pane">
    <h2 class="mc-pane-title">Recurring</h2>
    {#if dashboard.recurring.length === 0}
        <p class="mc-empty">No recurring tasks.</p>
    {:else}
        <div class="mc-group">
            {#each dashboard.recurring as entry (entry.task.sourcePath + ":" + entry.task.sourceLine)}
                <div class="mc-recurring-entry">
                    <TaskItem {app} task={entry.task} {todayISO} on:toggle={(e) => dispatch("toggle", { task: e.detail.task })} />
                    <p class="mc-recurring-meta">
                        🔁 {entry.task.recurrence}
                        {#if entry.nextDate}<span class="mc-recurring-next"> · next {relativeLabel(entry.nextDate, todayISO)}</span>{/if}
                    </p>
                </div>
            {/each}
        </div>
    {/if}
</section>

<style>
    .mc-recurring-entry {
        margin-bottom: 4px;
    }
    .mc-recurring-meta {
        margin: 0 0 8px 36px;
        font-size: 0.75em;
        color: var(--text-muted);
    }
    .mc-recurring-next {
        color: var(--text-accent);
    }
</style>
