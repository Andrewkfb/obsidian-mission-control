<script lang="ts">
    import type { Dashboard } from "src/tasks/grouping"
    import type { Task } from "src/tasks/Task"
    import TaskItem from "../TaskItem.svelte"
    import type { App } from "obsidian"

    interface Props {
        app: App
        dashboard: Dashboard
        todayISO: string
        ontoggle: (task: Task) => Promise<boolean>
    }

    let { app, dashboard, todayISO, ontoggle }: Props = $props()
</script>

<section class="mc-pane">
    <h2 class="mc-pane-title">Upcoming</h2>
    {#if dashboard.upcoming.length === 0}
        <p class="mc-empty">Nothing on the horizon.</p>
    {:else}
        {#each dashboard.upcoming as group (group.key)}
            <div class="mc-group">
                <h3 class="mc-group-title">{group.title} <span class="mc-count">{group.tasks.length}</span></h3>
                {#each group.tasks as task (task.sourcePath + ":" + task.sourceLine)}
                    <TaskItem {app} {task} {todayISO} {ontoggle} />
                {/each}
            </div>
        {/each}
    {/if}
</section>
