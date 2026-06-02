<script lang="ts">
    import type { Dashboard } from "src/tasks/grouping"
    import type { Task } from "src/tasks/Task"
    import TaskItem from "../TaskItem.svelte"
    import { createEventDispatcher } from "svelte"

    export let dashboard: Dashboard
    export let todayISO: string
    export let activeProject: string | null

    const dispatch = createEventDispatcher<{
        toggle: { task: Task }
        clearProject: void
    }>()
</script>

<section class="mc-pane">
    <h2 class="mc-pane-title">Today</h2>
    {#if activeProject}
        <button class="mc-clear-filter" on:click={() => dispatch("clearProject")}>
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
                    <TaskItem {task} {todayISO} on:toggle={(e) => dispatch("toggle", { task: e.detail.task })} />
                {/each}
            </div>
        {/each}
    {/if}
</section>
