<script lang="ts">
    import { App, Menu, TFile, TFolder, type EventRef } from "obsidian"
    import { onMount, onDestroy } from "svelte"
    import { pluginSettingsStore } from "src/store"
    import type { HomeTabSettings } from "src/settings"
    import FileDisplayItem from "src/ui/svelteComponents/fileDisplayItem.svelte"

    export let app: App

    let fileList: TFile[] = []
    let pluginSettings: HomeTabSettings
    let inboxFolder: string = ''

    $: pluginSettings = $pluginSettingsStore
    $: inboxFolder = $pluginSettingsStore?.inboxFolder ?? '01 Inbox'
    $: inboxFolder, loadFiles()

    function loadFiles() {
        const entry = app.vault.getAbstractFileByPath(inboxFolder)
        if (!entry || !(entry instanceof TFolder)) {
            fileList = []
            return
        }
        fileList = entry.children
            .filter((f): f is TFile => f instanceof TFile)
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
    }

    let refs: EventRef[] = []

    onMount(() => {
        loadFiles()
        refs = [
            app.vault.on('create', loadFiles),
            app.vault.on('delete', loadFiles),
            app.vault.on('rename', loadFiles),
            app.vault.on('modify', loadFiles),
        ]
    })

    onDestroy(() => {
        refs.forEach(ref => app.vault.offref(ref))
    })

    const contextualMenu = new Menu().setUseNativeMenu(app.vault.config.nativeMenus)
</script>

<div class="mc-files-pane">
    {#if !inboxFolder}
        <p class="mc-empty">No inbox folder configured. Set one in settings.</p>
    {:else if fileList.length === 0}
        <p class="mc-empty">
            {app.vault.getAbstractFileByPath(inboxFolder) ? 'Inbox is empty.' : `Folder "${inboxFolder}" not found.`}
        </p>
    {:else}
        <div class="mc-files-grid">
            {#each fileList as file (file.path)}
                <FileDisplayItem
                    {file}
                    {app}
                    {pluginSettings}
                    {contextualMenu}
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
