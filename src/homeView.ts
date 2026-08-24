import { FileView, WorkspaceLeaf } from "obsidian";
import type HomeTab from "./main";
import Homepage from './ui/homepage.svelte'
import HomeTabSearchBar from "./homeTabSearchbar";
import { flushSync, mount, unmount } from 'svelte'

export const VIEW_TYPE = "mission-control-view";

export class HomeTabView extends FileView{
    plugin: HomeTab
    homepage?: Record<string, unknown>
    searchBar: HomeTabSearchBar
    constructor(leaf: WorkspaceLeaf, plugin: HomeTab) {
        super(leaf);
        this.leaf = leaf
        this.plugin = plugin
        this.navigation = true
        this.allowNoFile = true
        this.icon = 'search'

        this.searchBar = new HomeTabSearchBar(this.plugin, this)
    }

    getViewType() {
        return VIEW_TYPE;
    }
    
    getDisplayText(): string {
		return 'Mission control'
    }

    async onOpen(): Promise<void> {
        this.homepage = mount(Homepage, {
            target: this.contentEl,
            props:{
                plugin: this.plugin,
                HomeTabSearchBar: this.searchBar
            }
        });
        // `mount()` defers user effects, so `bind:this` refs (the search input and
        // its suggestion container) are still undefined here. Flush them before
        // loading the search bar, which reads those elements synchronously.
        flushSync()
        this.searchBar.load()
        this.searchBar.focusSearchbar()
    }

    async onClose(): Promise<void>{
        this.searchBar.fileSuggester?.close()
        if (this.homepage) await unmount(this.homepage)
        this.homepage = undefined
    }
} 
