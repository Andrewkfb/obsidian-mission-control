<script lang="ts">
    interface Props {
        /** Vault path the task will be appended to, or null when nothing is configured. */
        targetPath: string | null
        /** Human-readable name for that target, shown next to the field. */
        targetLabel: string
        /** True when the target came from the active project rather than the setting. */
        targetIsProject: boolean
        /** Resolves true when the task was written. */
        oncreate: (text: string) => Promise<boolean>
    }

    let { targetPath, targetLabel, targetIsProject, oncreate }: Props = $props()

    let text = $state("")
    let busy = $state(false)
    let inputEl = $state<HTMLInputElement>()

    const canAdd = $derived(targetPath !== null && text.trim().length > 0 && !busy)

    async function submit() {
        if (!canAdd) return
        busy = true
        const created = await oncreate(text)
        busy = false
        if (created) {
            // Only clear on success, so a failed write doesn't lose what was typed.
            text = ""
            inputEl?.focus()
        }
    }
</script>

<div class="mc-quickadd">
    <input
        bind:this={inputEl}
        bind:value={text}
        type="text"
        class="mc-quickadd-input"
        placeholder={targetPath ? "Add a task…  (📅 2026-06-01  ⏫  #tag  🔁 every week)" : "Set a quick-add note in settings to capture tasks here"}
        aria-label="New task"
        disabled={targetPath === null}
        onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit() } }}
    />
    <button class="mc-quickadd-btn" disabled={!canAdd} onclick={() => void submit()}>
        {busy ? "Adding…" : "Add"}
    </button>
</div>
{#if targetPath}
    <p class="mc-quickadd-target">
        {targetIsProject ? "Adding to the selected project" : "Adding to"}
        <span class="mc-quickadd-target-name">{targetLabel}</span>
    </p>
{/if}

<style>
    .mc-quickadd {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 16px;
    }
    .mc-quickadd-input {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 40px;
        font: inherit;
        padding: 6px 10px;
        background: var(--background-modifier-form-field);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
    }
    .mc-quickadd-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .mc-quickadd-btn {
        flex: 0 0 auto;
        min-height: 40px;
        padding: 0 14px;
    }
    .mc-quickadd-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .mc-quickadd-target {
        margin: 4px 2px 0;
        font-size: 0.75em;
        color: var(--text-muted);
    }
    .mc-quickadd-target-name {
        color: var(--text-accent);
    }
</style>
