<script lang="ts">
    import { onDestroy, onMount, createEventDispatcher } from "svelte"
    import { setIcon } from "obsidian"

    // List of tag names (no '#') that should appear in the menu.
    export let availableTags: string[]
    // Currently-active filter tags.
    export let activeTags: string[]

    const dispatch = createEventDispatcher<{ change: { tags: string[] } }>()

    let open = false
    let iconEl: HTMLElement
    let rootEl: HTMLElement

    $: hasFilter = activeTags.length > 0

    function toggle(tag: string) {
        const next = activeTags.includes(tag)
            ? activeTags.filter(t => t !== tag)
            : [...activeTags, tag]
        dispatch("change", { tags: next })
    }

    function clear() {
        dispatch("change", { tags: [] })
    }

    function onDocClick(e: MouseEvent) {
        if (!open) return
        if (rootEl && !rootEl.contains(e.target as Node)) open = false
    }
    function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") open = false
    }

    onMount(() => {
        if (iconEl) setIcon(iconEl, "filter")
        document.addEventListener("click", onDocClick)
        document.addEventListener("keydown", onKey)
    })
    onDestroy(() => {
        document.removeEventListener("click", onDocClick)
        document.removeEventListener("keydown", onKey)
    })
</script>

<div class="mc-filter-root" bind:this={rootEl}>
    <button
        class="mc-filter-btn"
        class:mc-filter-active={hasFilter}
        aria-label={hasFilter ? `Tag filter (${activeTags.length} active)` : "Tag filter"}
        on:click={() => (open = !open)}
    >
        <span bind:this={iconEl} class="mc-filter-icon" />
        {#if hasFilter}<span class="mc-filter-dot" />{/if}
    </button>

    {#if open}
        <div class="mc-filter-menu" role="menu">
            <div class="mc-filter-menu-head">
                <span>Filter by tag</span>
                {#if hasFilter}
                    <button class="mc-filter-clear" on:click={clear}>Clear</button>
                {/if}
            </div>
            {#if availableTags.length === 0}
                <p class="mc-filter-empty">No tags available. Add tags in your task notes or adjust the whitelist in plugin settings.</p>
            {:else}
                <ul class="mc-filter-list">
                    {#each availableTags as tag (tag)}
                        <li>
                            <label>
                                <input type="checkbox" checked={activeTags.includes(tag)} on:change={() => toggle(tag)} />
                                <span>#{tag}</span>
                            </label>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    {/if}
</div>

<style>
    .mc-filter-root {
        position: relative;
        display: inline-flex;
        align-items: center;
    }
    .mc-filter-btn {
        position: relative;
        background: none;
        box-shadow: none;
        padding: 8px;
        min-height: 36px;
        min-width: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        border-radius: 6px;
    }
    .mc-filter-btn:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
    .mc-filter-btn.mc-filter-active { color: var(--text-accent); }
    .mc-filter-icon :global(svg) { width: 18px; height: 18px; }
    .mc-filter-dot {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--interactive-accent);
    }
    .mc-filter-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 50;
        min-width: 220px;
        max-height: 60vh;
        overflow-y: auto;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 8px;
    }
    .mc-filter-menu-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8em;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 4px 6px 8px;
    }
    .mc-filter-clear {
        background: none;
        box-shadow: none;
        padding: 0;
        color: var(--text-accent);
        font-size: 0.9em;
        text-transform: none;
        letter-spacing: normal;
    }
    .mc-filter-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .mc-filter-list li label {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
        border-radius: 4px;
        cursor: pointer;
    }
    .mc-filter-list li label:hover { background: var(--background-modifier-hover); }
    .mc-filter-empty {
        margin: 4px 6px;
        font-size: 0.85em;
        color: var(--text-muted);
        font-style: italic;
    }
</style>
