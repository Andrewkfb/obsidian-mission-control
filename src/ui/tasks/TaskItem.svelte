<script lang="ts">
    import { TFile, type App } from "obsidian"
    import type { Task } from "src/tasks/Task"
    import { relativeLabel } from "src/tasks/dates"
    import { overdueByDays } from "src/tasks/grouping"
    import { pluginSettingsStore } from "src/store"

    interface Props {
        app: App
        task: Task
        todayISO: string
        /** Resolves true when the write succeeded, false when it failed. */
        ontoggle: (task: Task) => Promise<boolean>
    }

    let { app, task, todayISO, ontoggle }: Props = $props()

    const PRIORITY_LABEL: Record<string, string> = {
        highest: "🔺",
        high: "⏫",
        medium: "🔼",
        low: "🔽",
        lowest: "⏬",
        normal: "",
    }

    // Optimistic state: the row shows the new value straight away while the
    // vault write and the re-index happen behind it.
    //
    // Settling purely on the write's promise would be wrong — the write
    // resolves well before TaskIndex re-parses the file, so the row would snap
    // back to the old value and then flip again. Instead a failure reverts at
    // once, and a success holds until the re-indexed task actually agrees,
    // with a backstop in case that never arrives.
    let pending = $state(false)
    let expected = $state<boolean | null>(null)
    let backstopTimer: number | undefined

    function settle() {
        pending = false
        expected = null
        if (backstopTimer !== undefined) {
            window.clearTimeout(backstopTimer)
            backstopTimer = undefined
        }
    }

    async function handleCheckbox(e: MouseEvent) {
        e.stopPropagation()
        if (pending) return
        pending = true
        expected = !task.checked

        if (await ontoggle(task)) {
            if (backstopTimer !== undefined) window.clearTimeout(backstopTimer)
            backstopTimer = window.setTimeout(settle, 5000)
        } else {
            // The write failed and the caller has surfaced why — don't keep
            // showing a state the file never took.
            settle()
        }
    }

    // The re-indexed task caught up, so the optimistic state has served its purpose.
    $effect(() => {
        if (pending && expected !== null && task.checked === expected) settle()
    })

    // Don't leave a timer running against a destroyed row.
    $effect(() => () => {
        if (backstopTimer !== undefined) window.clearTimeout(backstopTimer)
    })

    function openTask(newTab: boolean) {
        const file = app.vault.getAbstractFileByPath(task.sourcePath)
        if (file instanceof TFile) {
            void app.workspace.getLeaf(newTab).openFile(file, { eState: { line: task.sourceLine } })
        }
    }

    // Split task.text into alternating plain text + wikilink segments so each
    // [[Link]] (or [[Target|Display]]) becomes a clickable anchor.
    type Segment = { kind: "text"; value: string } | { kind: "link"; target: string; display: string }
    function parseSegments(text: string): Segment[] {
        const out: Segment[] = []
        const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g
        let last = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
            if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) })
            const target = m[1].trim()
            const display = (m[2] ?? m[1]).trim()
            out.push({ kind: "link", target, display })
            last = m.index + m[0].length
        }
        if (last < text.length) out.push({ kind: "text", value: text.slice(last) })
        return out
    }
    const segments = $derived(parseSegments(task.text))

    function openLink(e: MouseEvent | KeyboardEvent, target: string) {
        e.stopPropagation()
        e.preventDefault()
        void app.workspace.openLinkText(target, task.sourcePath, e.ctrlKey || e.metaKey)
    }

    const overdueDays = $derived(overdueByDays(task, todayISO))
    const dateLabel = $derived(task.due
        ? relativeLabel(task.due, todayISO)
        : task.scheduled
        ? relativeLabel(task.scheduled, todayISO)
        : "")
    // Optimistic checked state: show the intended value while a write is in flight.
    const displayChecked = $derived(pending && expected !== null ? expected : task.checked)
</script>

<!--
    The row is a plain container, not a control. It used to carry role="button"
    while containing a button and anchors, which is invalid nesting: assistive
    tech flattens it and the inner controls become unreachable. The two real
    actions are now real buttons, and clicking the row is a redundant mouse
    shortcut for the "open" button beside it.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="mc-task-item"
    class:mc-checked={displayChecked}
    onclick={(e) => {
        if (e.target instanceof Element && e.target.closest('button, a')) return
        openTask(e.ctrlKey || e.metaKey)
    }}
>
    <!--
        role="checkbox" rather than a pressed button: this toggles a value, it
        doesn't trigger an action. A native <button> already fires click on
        Enter and Space, so there is no keydown handler to add — the previous
        one double-fired and was only masked by the pending guard.
    -->
    <button
        class="mc-task-checkbox-btn"
        class:mc-done={displayChecked}
        class:mc-pending={pending}
        role="checkbox"
        aria-checked={displayChecked}
        aria-label={task.text || "Task"}
        onclick={handleCheckbox}
    >
        {#if displayChecked}
            ✓
        {:else if pending}
            …
        {:else}
            &nbsp;
        {/if}
    </button>

    <span class="mc-task-text">
        {#each segments as seg}
            {#if seg.kind === "text"}{seg.value}{:else}<a
                class="mc-task-link internal-link"
                href={seg.target}
                onclick={(e) => openLink(e, seg.target)}
            >{seg.display}</a>{/if}
        {/each}
    </span>

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

    <span class="mc-task-project">
        {task.project}{#if task.heading && $pluginSettingsStore?.showHeadings}<span class="mc-task-heading"> › {task.heading}</span>{/if}
    </span>

    <!-- The keyboard-reachable way to open the task; the row click mirrors it. -->
    <button
        class="mc-task-open"
        aria-label="Open task in {task.project}"
        onclick={(e) => { e.stopPropagation(); openTask(e.ctrlKey || e.metaKey) }}
    >↗</button>
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
        max-width: 100%;
        overflow: hidden;
        box-sizing: border-box;
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
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .mc-checked .mc-task-text {
        text-decoration: line-through;
        color: var(--text-muted);
    }
    .mc-task-link {
        color: var(--text-accent);
        text-decoration: none;
        cursor: pointer;
    }
    .mc-task-link:hover {
        text-decoration: underline;
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
        flex: 0 1 auto;
        min-width: 0;
        font-size: 0.75em;
        color: var(--text-accent);
        background: var(--background-modifier-hover);
        padding: 2px 8px;
        border-radius: 10px;
        max-width: min(220px, 40vw);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .mc-task-heading {
        color: var(--text-muted);
    }
    .mc-task-open {
        flex: 0 0 auto;
        background: none;
        box-shadow: none;
        padding: 4px 8px;
        color: var(--text-muted);
        opacity: 0;
    }
    .mc-task-item:hover .mc-task-open,
    .mc-task-open:focus-visible {
        opacity: 1;
    }
    /* There is no hover on touch, so don't hide the only visible open control. */
    @media (pointer: coarse) {
        .mc-task-open { opacity: 1; }
    }
</style>
