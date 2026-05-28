<script lang="ts">
    import { TFile } from "obsidian"
    import type { Task } from "src/tasks/Task"
    import { relativeLabel } from "src/tasks/dates"
    import { overdueByDays } from "src/tasks/grouping"

    export let task: Task
    export let todayISO: string

    const PRIORITY_LABEL: Record<string, string> = {
        highest: "⏫⏫",
        high: "⏫",
        low: "🔽",
        lowest: "⏬",
        normal: "",
    }

    function openTask(newTab: boolean) {
        const file = app.vault.getAbstractFileByPath(task.sourcePath)
        if (file instanceof TFile) {
            app.workspace.getLeaf(newTab).openFile(file, { eState: { line: task.sourceLine } })
        }
    }

    $: overdueDays = overdueByDays(task, todayISO)
    $: dateLabel = task.due
        ? relativeLabel(task.due, todayISO)
        : task.scheduled
        ? relativeLabel(task.scheduled, todayISO)
        : ""
</script>

<div
    class="mc-task-item"
    class:mc-checked={task.checked}
    role="button"
    tabindex="0"
    on:click={(e) => openTask(e.ctrlKey || e.metaKey)}
    on:keydown={(e) => { if (e.key === "Enter") openTask(false) }}
>
    <span class="mc-task-checkbox" class:mc-done={task.checked} aria-hidden="true">
        {task.statusChar === " " ? "" : task.statusChar}
    </span>

    <span class="mc-task-text">{task.text}</span>

    {#if PRIORITY_LABEL[task.priority]}
        <span class="mc-task-priority">{PRIORITY_LABEL[task.priority]}</span>
    {/if}

    {#if dateLabel}
        <span class="mc-task-date" class:mc-overdue={overdueDays > 0}>
            {overdueDays > 0 ? `${overdueDays}d overdue` : dateLabel}
        </span>
    {/if}

    {#if task.recurrence}
        <span class="mc-task-recurrence" aria-label="Recurring">🔁</span>
    {/if}

    <span class="mc-task-project">{task.project}</span>
</div>

<style>
    .mc-task-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        min-height: 44px; /* comfortable touch target on mobile */
        border-radius: var(--radius-s);
        cursor: pointer;
    }
    .mc-task-item:hover {
        background: var(--background-modifier-hover);
    }
    .mc-task-checkbox {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        border: 1.5px solid var(--text-muted);
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8em;
        line-height: 1;
    }
    .mc-task-checkbox.mc-done {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }
    .mc-task-text {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .mc-checked .mc-task-text {
        text-decoration: line-through;
        color: var(--text-muted);
    }
    .mc-task-priority {
        flex: 0 0 auto;
        font-size: 0.85em;
    }
    .mc-task-date {
        flex: 0 0 auto;
        font-size: 0.8em;
        color: var(--text-muted);
        white-space: nowrap;
    }
    .mc-task-date.mc-overdue {
        color: var(--text-error);
        font-weight: 600;
    }
    .mc-task-recurrence {
        flex: 0 0 auto;
        font-size: 0.8em;
    }
    .mc-task-project {
        flex: 0 0 auto;
        font-size: 0.75em;
        color: var(--text-accent);
        background: var(--background-modifier-hover);
        padding: 2px 8px;
        border-radius: 10px;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
