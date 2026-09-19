<script lang="ts">
    import { untrack } from "svelte"
    import { App, Menu, TFile } from "obsidian"
    import { recentFiles as recentFilesStore, pluginSettingsStore } from "src/store"
    import type { RecentFileManager, RecentFile } from "src/recentFiles"
    import type { HomeTabSettings } from "src/settings"
    import FileDisplayItem from "src/ui/svelteComponents/fileDisplayItem.svelte"

    interface Props {
        app: App
        recentFileManager: RecentFileManager
    }

    let { app, recentFileManager }: Props = $props()

    const fileList: RecentFile[] = $derived($recentFilesStore ?? [])
    const pluginSettings: HomeTabSettings = $derived($pluginSettingsStore)

    let selectedFile: TFile

    // Built once per pane: `app` and the manager never change for an instance.
    const contextualMenu = untrack(() => new Menu()
        .addItem((item) =>
            item.setTitle("Hide file").setIcon("eye-off").onClick(() =>
                recentFileManager.removeRecentFile(selectedFile)
            )
        )
        .setUseNativeMenu(app.vault.config.nativeMenus))
</script>

<div class="mc-files-pane">
    {#if fileList.length === 0}
        <p class="mc-empty">No recent files.</p>
    {:else}
        <div class="mc-files-grid">
            {#each fileList as item (item.file.path)}
                <FileDisplayItem
                    file={item.file}
                    {app}
                    {pluginSettings}
                    {contextualMenu}
                    onitemMenu={(f) => (selectedFile = f)}
                />
            {/each}
        </div>
    {/if}
</div>

<style>
    .mc-files-pane {
        padding-top: 8px;
    }
    .mc-files-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-start;
    }
</style>
