<script lang="ts">
    import { type TFile, Keymap, type PaneType, App, Menu } from 'obsidian';
    import { getFileTypeFromExtension } from 'src/utils/getFileTypeUtils';
	import type { HomeTabSettings } from 'src/settings';
	import { createEventDispatcher } from 'svelte';
	import type { LucideIcon } from 'src/utils/lucideIcons';
    import ObsidianIcon from './ObsidianIcon.svelte';

    export let app: App
    export let file: TFile
    export let pluginSettings: HomeTabSettings
    export let contextualMenu: Menu
    export let customIcon: LucideIcon | undefined = undefined

    const filename = file.basename
    const fileType = getFileTypeFromExtension(file.extension)
    $: icon = customIcon ?? (fileType === 'markdown'
        ? 'file-text'
        : fileType === 'image'
        ? 'file-image'
        : fileType === 'video'
        ? 'file-video'
        : fileType === 'audio'
        ? 'file-audio'
        : 'file')

    const dispatch = createEventDispatcher<{itemMenu:{file: TFile}}>()

    function handleFileOpening(file: TFile, newTab?: boolean | PaneType){
        const leaf = app.workspace.getLeaf(newTab)
        void leaf.openFile(file)
    }

    function handleMouseClick(e: MouseEvent, file: TFile): void{
        if ((e.target as HTMLElement).closest('.home-tab-file-item-remove-btn')) return
        else if(e.button != 2){
            handleFileOpening(file, Keymap.isModEvent(e))
        }
    }
</script>

<div class="home-tab-file-item" class:use-accent-color="{pluginSettings.selectionHighlight === 'accentColor'}"
    role="button" tabindex="0"
    on:mousedown|preventDefault="{e => handleMouseClick(e, file)}"
    on:keydown={(e) => { if (e.key === 'Enter') handleFileOpening(file, Keymap.isModEvent(e)) }}>
    
    <button class="home-tab-file-item-remove-btn" aria-label="File options"
        on:mousedown|stopPropagation
        on:click={(e) => {
            contextualMenu.showAtMouseEvent(e)
            dispatch('itemMenu', {file: file})
            }}>
        <ObsidianIcon icon="more-horizontal" />
    </button>

    <div class="home-tab-file-item-preview-icon">
        <ObsidianIcon {icon} />
    </div>
    <div class="home-tab-file-item-name">
        {filename}
    </div>
</div>

<style>
    .home-tab-file-item{
        margin: 5px;
        padding: 5px;
        border-radius: var(--radius-m);
        min-width: 75px;
        max-width: 125px;

        position: relative;
    }

    .home-tab-file-item:hover{
        background-color: var(--background-modifier-hover);
    }
    .home-tab-file-item.use-accent-color:hover{
        color: white;
        background: var(--interactive-accent);
    }
    .home-tab-file-item-preview-icon{
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--size-2-3);
    }

    .home-tab-file-item-name{
        text-align: center;
        font-size: var(--font-ui-small);

        /* Text trimming */
        display: -webkit-box;
        overflow: hidden;
        text-overflow: ellipsis;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
    }

    .home-tab-file-item-remove-btn {
        opacity: 0;
        position: absolute;
        top: 4px;
        right: 4px;
        padding: 0;
        background: none;
        box-shadow: none;
    }

    .home-tab-file-item-remove-btn:hover,
    .home-tab-file-item-remove-btn:focus-visible {
        opacity: 1;
    }
</style>
