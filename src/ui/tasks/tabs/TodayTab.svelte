<script lang="ts">
    import type { Dashboard } from "src/tasks/grouping"
    import type { Task } from "src/tasks/Task"
    import TaskItem from "../TaskItem.svelte"
    import type { App } from "obsidian"

    interface Props {
        app: App
        dashboard: Dashboard
        todayISO: string
        activeProject: string | null
        ontoggle: (task: Task) => Promise<boolean>
        onclearProject: () => void
    }

    let { app, dashboard, todayISO, activeProject, ontoggle, onclearProject }: Props = $props()
</script>

<section class="mc-pane">
    <h2 class="mc-pane-title">Today</h2>
    {#if activeProject}
        <button class="mc-clear-filter" onclick={() => onclearProject()}>
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
                    <TaskItem {app} {task} {todayISO} {ontoggle} />
                {/each}
            </div>
        {/each}
    {/if}
</section>
