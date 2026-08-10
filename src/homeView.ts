import { FileView, WorkspaceLeaf } from "obsidian";
import type HomeTab from "./main";
import Homepage from './ui/homepage.svelte'
import HomeTabSearchBar from "./homeTabSearchbar";

export const VIEW_TYPE = "mission-control-view";

export class HomeTabView extends FileView{
    plugin: HomeTab
    homepage!: Homepage
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
        this.homepage = new Homepage({
            target: this.contentEl,
            props:{
                plugin: this.plugin,
                HomeTabSearchBar: this.searchBar
            }
        });
        this.searchBar.load()
        this.searchBar.focusSearchbar()
    }

    async onClose(): Promise<void>{
        this.searchBar.fileSuggester.close()
        this.homepage.$destroy();
    }
} 
