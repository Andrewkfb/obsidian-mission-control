<script lang="ts">
    import { type TFile, Keymap, type PaneType, App, Menu } from 'obsidian';
    import { getFileTypeFromExtension } from 'src/utils/getFileTypeUtils';
	import type { HomeTabSettings } from 'src/settings';
	import type { LucideIcon } from 'src/utils/lucideIcons';
    import ObsidianIcon from './ObsidianIcon.svelte';

    interface Props {
        app: App
        file: TFile
        pluginSettings: HomeTabSettings
        contextualMenu: Menu
        customIcon?: LucideIcon
        /** Fired when the options menu opens, so the parent can track which file it applies to. */
        onitemMenu?: (file: TFile) => void
    }

    let { app, file, pluginSettings, contextualMenu, customIcon = undefined, onitemMenu = undefined }: Props = $props()

    const filename = $derived(file.basename)
    const fileType = $derived(getFileTypeFromExtension(file.extension))
    const icon = $derived(customIcon ?? (fileType === 'markdown'
        ? 'file-text'
        : fileType === 'image'
        ? 'file-image'
        : fileType === 'video'
        ? 'file-video'
        : fileType === 'audio'
        ? 'file-audio'
        : 'file'))

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

<div class="home-tab-file-item" class:use-accent-color={pluginSettings.selectionHighlight === 'accentColor'}
    role="button" tabindex="0"
    onmousedown={(e) => { e.preventDefault(); handleMouseClick(e, file) }}
    onkeydown={(e) => { if (e.key === 'Enter') handleFileOpening(file, Keymap.isModEvent(e)) }}>
    
    <button class="home-tab-file-item-remove-btn" aria-label="File options"
        onmousedown={(e) => e.stopPropagation()}
        onclick={(e) => {
            contextualMenu.showAtMouseEvent(e)
            onitemMenu?.(file)
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
