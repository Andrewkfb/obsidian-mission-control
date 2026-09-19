<script lang="ts">
    import { TFile, type App } from "obsidian"
    import type { Dashboard, ProjectSummary } from "src/tasks/grouping"
    import { pluginSettingsStore } from "src/store"

    interface Props {
        app: App
        dashboard: Dashboard
        activeProject: string | null
        onselectProject: (project: ProjectSummary) => void
    }

    let { app, dashboard, activeProject, onselectProject }: Props = $props()

    function openProject(p: ProjectSummary, newTab: boolean) {
        const file = app.vault.getAbstractFileByPath(p.sourcePath)
        if (file instanceof TFile) void app.workspace.getLeaf(newTab).openFile(file)
    }

    function openHeading(e: MouseEvent | KeyboardEvent, p: ProjectSummary, heading: string) {
        e.stopPropagation()
        e.preventDefault()
        // Resolve via the link API so it lands on the heading anchor in the source file.
        void app.workspace.openLinkText(`${p.project}#${heading}`, p.sourcePath, e.ctrlKey || e.metaKey)
    }
</script>

<section class="mc-pane">
    <h2 class="mc-pane-title">Projects</h2>
    {#if dashboard.projects.length === 0}
        <p class="mc-empty">No projects with open tasks.</p>
    {:else}
        {#each dashboard.projects as p (p.sourcePath)}
            <div class="mc-project-block" class:mc-selected={activeProject === p.sourcePath}>
                <div class="mc-project-row">
                    <button class="mc-project-name" onclick={() => onselectProject(p)} title="Filter dashboard to this project">
                        {p.project}
                    </button>
                    <span class="mc-project-count">{p.openCount}</span>
                    <button class="mc-project-open" onclick={(e) => openProject(p, e.ctrlKey || e.metaKey)} aria-label="Open project note">↗</button>
                </div>
                {#if p.headings.length > 0 && $pluginSettingsStore?.showHeadings}
                    <div class="mc-project-headings">
                        {#each p.headings as h (h)}
                            <a
                                class="mc-project-heading"
                                href={`${p.project}#${h}`}
                                onclick={(e) => openHeading(e, p, h)}
                                onkeydown={(e) => { if (e.key === "Enter") openHeading(e, p, h) }}
                            >{h}</a>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    {/if}
</section>

<style>
    .mc-project-block {
        padding: 4px 0;
    }
    .mc-project-block.mc-selected :global(.mc-project-name) {
        color: var(--text-accent);
        font-weight: 600;
    }
    .mc-project-headings {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 2px 0 6px 32px;
    }
    .mc-project-heading {
        font-size: 0.75em;
        color: var(--text-muted);
        background: var(--background-modifier-hover);
        padding: 2px 8px;
        border-radius: 10px;
        text-decoration: none;
        cursor: pointer;
    }
    .mc-project-heading:hover {
        color: var(--text-accent);
        text-decoration: underline;
    }
</style>
