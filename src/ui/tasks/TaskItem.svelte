<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { TFile } from "obsidian"
    import type { Task } from "src/tasks/Task"
    import { relativeLabel } from "src/tasks/dates"
    import { overdueByDays } from "src/tasks/grouping"

    export let task: Task
    export let todayISO: string

    const dispatch = createEventDispatcher<{ toggle: { task: Task } }>()

    const PRIORITY_LABEL: Record<string, string> = {
        highest: "⏫⏫",
        high: "⏫",
        low: "🔽",
        lowest: "⏬",
        normal: "",
    }

    // Optimistic local state — immediately reflects the toggle visually
    // while the async vault write happens in the background.
    let pending = false

    function handleCheckbox(e: MouseEvent | KeyboardEvent) {
        e.stopPropagation()
        if (pending) return
        pending = true
        dispatch("toggle", { task })
        // Reset pending after a short window; the TaskIndex watcher will
        // re-render the row with the real state once the vault write settles.
        setTimeout(() => { pending = false }, 1500)
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
    // Optimistic checked state: flip immediately on pending, revert when task prop updates.
    $: displayChecked = pending ? !task.checked : task.checked
</script>

<div
    class="mc-task-item"
    class:mc-checked={displayChecked}
    role="button"
    tabindex="0"
    on:click={(e) => { if (!(e.target instanceof Element && e.target.closest('.mc-task-checkbox-btn'))) openTask(e.ctrlKey || e.metaKey) }}
    on:keydown={(e) => { if (e.key === "Enter") openTask(false) }}
>
    <!-- Checkbox — separate interactive element so it doesn't open the file -->
    <button
        class="mc-task-checkbox-btn"
        class:mc-done={displayChecked}
        class:mc-pending={pending}
        aria-label={displayChecked ? "Mark as open" : "Mark as done"}
        aria-pressed={displayChecked}
        on:click|stopPropagation={handleCheckbox}
        on:keydown|stopPropagation={(e) => { if (e.key === " " || e.key === "Enter") handleCheckbox(e) }}
    >
        {#if displayChecked}
            ✓
        {:else if pending}
            …
        {:else}
            &nbsp;
        {/if}
    </button>

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
        <span class="mc-task-recurrence" aria-label="Recurring: {task.recurrence}">🔁</span>
    {/if}

    <span class="mc-task-project">{task.project}</span>
</div>

<style>
    .mc-task-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        min-height: 44px;
        border-radius: var(--radius-s);
        cursor: pointer;
    }
    .mc-task-item:hover {
        background: var(--background-modifier-hover);
    }
    .mc-task-checkbox-btn {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        min-width: 20px;
        border: 1.5px solid var(--text-muted);
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8em;
        line-height: 1;
        padding: 0;
        background: transparent;
        box-shadow: none;
        cursor: pointer;
        /* Expand tap area for mobile without changing visual size */
        position: relative;
    }
    .mc-task-checkbox-btn::before {
        content: "";
        position: absolute;
        inset: -10px;
    }
    .mc-task-checkbox-btn.mc-done {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }
    .mc-task-checkbox-btn.mc-pending {
        opacity: 0.5;
        cursor: wait;
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
