<script lang="ts">
    import { App, Menu, TFile, TFolder, debounce, type TAbstractFile } from "obsidian"
    import { onMount, untrack } from "svelte"
    import { pluginSettingsStore } from "src/store"
    import type { HomeTabSettings } from "src/settings"
    import FileDisplayItem from "src/ui/svelteComponents/fileDisplayItem.svelte"
    import { isDirectChildOf } from "src/utils/paths"

    interface Props {
        app: App
    }

    let { app }: Props = $props()

    let fileList = $state<TFile[]>([])
    let folderExists = $state(false)

    const pluginSettings: HomeTabSettings = $derived($pluginSettingsStore)
    const inboxFolder: string = $derived($pluginSettingsStore?.inboxFolder ?? '01 Inbox')

    // Reload whenever the configured folder changes. Runs on init too, so there
    // is no need to load again on mount.
    $effect(() => {
        inboxFolder
        loadFiles()
    })

    function loadFiles() {
        const entry = app.vault.getAbstractFileByPath(inboxFolder)
        folderExists = entry instanceof TFolder
        if (!(entry instanceof TFolder)) {
            fileList = []
            return
        }
        fileList = entry.children
            .filter((f): f is TFile => f instanceof TFile)
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
    }

    // Vault events cover the whole vault, and `modify` fires on every save of
    // any note anywhere. Re-walking and re-sorting the inbox for each one made
    // editing an unrelated note cost a folder scan per keystroke-save. Scope to
    // the inbox's own direct children — all `loadFiles` lists — and collapse
    // bursts. `modify` is kept because it reorders the mtime-sorted list.
    const reload = debounce(loadFiles, 200, true)

    function onVaultChange(file: TAbstractFile, oldPath?: string) {
        // A rename can move a file into or out of the inbox, so check both ends.
        const touchesInbox = isDirectChildOf(file.path, inboxFolder)
            || (oldPath !== undefined && isDirectChildOf(oldPath, inboxFolder))
        if (touchesInbox) reload()
    }

    onMount(() => {
        const refs = [
            app.vault.on('create', (f) => onVaultChange(f)),
            app.vault.on('delete', (f) => onVaultChange(f)),
            app.vault.on('rename', (f, oldPath) => onVaultChange(f, oldPath)),
            app.vault.on('modify', (f) => onVaultChange(f)),
        ]
        return () => {
            reload.cancel()
            refs.forEach(ref => app.vault.offref(ref))
        }
    })

    // Built once per pane: `app` never changes for an instance.
    const contextualMenu = untrack(() => new Menu().setUseNativeMenu(app.vault.config.nativeMenus))
</script>

<div class="mc-files-pane">
    {#if !inboxFolder}
        <p class="mc-empty">No inbox folder configured. Set one in settings.</p>
    {:else if fileList.length === 0}
        <p class="mc-empty">
            {folderExists ? 'Inbox is empty.' : `Folder "${inboxFolder}" not found.`}
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
