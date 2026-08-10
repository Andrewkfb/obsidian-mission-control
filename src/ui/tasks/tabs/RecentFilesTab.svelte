<script lang="ts">
    import { App, Menu, TFile } from "obsidian"
    import { recentFiles as recentFilesStore, pluginSettingsStore } from "src/store"
    import type { RecentFileManager, RecentFile } from "src/recentFiles"
    import type { HomeTabSettings } from "src/settings"
    import FileDisplayItem from "src/ui/svelteComponents/fileDisplayItem.svelte"

    export let app: App
    export let recentFileManager: RecentFileManager

    let fileList: RecentFile[] = []
    let pluginSettings: HomeTabSettings

    $: fileList = $recentFilesStore ?? []
    $: pluginSettings = $pluginSettingsStore

    let selectedFile: TFile

    const contextualMenu = new Menu()
        .addItem((item) =>
            item.setTitle("Hide file").setIcon("eye-off").onClick(() =>
                recentFileManager.removeRecentFile(selectedFile)
            )
        )
        .setUseNativeMenu(app.vault.config.nativeMenus)
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
                    on:itemMenu={(e) => (selectedFile = e.detail.file)}
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
