<script lang="ts">
    import { App, Menu, TFile } from "obsidian"
    import { IconSelectionModal } from "src/iconSelectionModal"
    import { bookmarkedFiles as bookmarkedFilesStore, pluginSettingsStore } from "src/store"
    import type { bookmarkedFile, bookmarkedFilesManager } from "src/bookmarkedFiles"
    import type { HomeTabSettings } from "src/settings"
    import FileDisplayItem from "src/ui/svelteComponents/fileDisplayItem.svelte"

    export let app: App
    export let bookmarkedFileManager: bookmarkedFilesManager

    let fileList: bookmarkedFile[] = []
    let pluginSettings: HomeTabSettings

    $: fileList = $bookmarkedFilesStore ?? []
    $: pluginSettings = $pluginSettingsStore

    let selectedFile: TFile

    const selectIconModal = new IconSelectionModal(app, undefined, (icon) =>
        bookmarkedFileManager.updateFileIcon(selectedFile, icon)
    )

    const contextualMenu = new Menu()
        .addItem((item) =>
            item.setTitle("Remove bookmark").setIcon("trash-2").onClick(() =>
                bookmarkedFileManager.removeBookmark(selectedFile)
            )
        )
        .addSeparator()
        .addItem((item) =>
            item.setTitle("Set custom icon").setIcon("plus").onClick(() => selectIconModal.open())
        )
        .setUseNativeMenu(app.vault.config.nativeMenus)
</script>

<div class="mc-files-pane">
    {#if fileList.length === 0}
        <p class="mc-empty">No bookmarked files.</p>
    {:else}
        <div class="mc-files-grid">
            {#each fileList as item (item.file.path)}
                <FileDisplayItem
                    file={item.file}
                    customIcon={item.iconId}
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
