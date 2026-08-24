import { Notice, type App, type View } from "obsidian";
import type HomeTab from "./main";
import { writable, type Writable, get } from "svelte/store";
import HomeTabFileSuggester from "src/suggester/homeTabSuggester";
import OmnisearchSuggester from "./suggester/omnisearchSuggester";
import { fileTypes, type FileExtension, type FileType, fileExtensions } from "./utils/getFileTypeUtils";

export type SearchBarFilterType = 'fileExtension' | 'fileType' | 'omnisearch' | 'default'

const omnisearchKeys = ['omnisearch', 'omni'] as const

type FilterKeyLookupTable = {[key in SearchBarFilterType]: string[]}
const filterKeysLookupTable: FilterKeyLookupTable = {
    default: [],
    omnisearch: [...omnisearchKeys],
    fileType: [...fileTypes],
    fileExtension: [...fileExtensions],
}

export const filterKeys = [...filterKeysLookupTable.omnisearch,
                    ...filterKeysLookupTable.fileType, ...filterKeysLookupTable.fileExtension]

export type FilterKey = typeof filterKeys[number]

export default class HomeTabSearchBar{
    private app: App
    private onLoad?: () => void
    public activeFilter: SearchBarFilterType = 'default'
    
    protected view: View
    protected plugin: HomeTab
    
    public fileSuggester!: HomeTabFileSuggester | OmnisearchSuggester
    public activeExtEl: Writable<HTMLElement>
    public searchBarEl: Writable<HTMLInputElement>
    public suggestionContainerEl: Writable<HTMLElement>

    constructor(plugin: HomeTab, view: View, onLoad?: () => void) {
        this.app = view.app
        this.view = view;
        this.plugin = plugin;
        this.searchBarEl = writable();
        this.activeExtEl = writable();
        this.suggestionContainerEl = writable();
        this.onLoad = onLoad;
    }

    public focusSearchbar(): void {
        // Set cursor on search bar
        get(this.searchBarEl)?.focus();
    }

    // Omnisearch exposes its API on `window.omnisearch`, which can lag behind the
    // plugin being enabled. Fall back to fuzzy search instead of throwing.
    private isOmnisearchAvailable(): boolean {
        return !!this.app.plugins.getPlugin('omnisearch') && !!window.omnisearch
    }

    private createDefaultSuggester(): HomeTabFileSuggester | OmnisearchSuggester {
        if (this.plugin.settings.omnisearch && this.isOmnisearchAvailable()) {
            return new OmnisearchSuggester(this.plugin.app, this.plugin, this.view, this)
        }
        return new HomeTabFileSuggester(this.plugin.app, this.plugin, this.view, this)
    }

    public load(): void {
        this.fileSuggester = this.createDefaultSuggester()
        this.onLoad?.()
    }

    public updateActiveSuggester(filterKey: FilterKey){
        this.fileSuggester.destroy()
        const filterEl = get(this.activeExtEl)

        let filter: SearchBarFilterType = 'default'

        // Match key from search bar input to filter type
        for(const filterType of Object.keys(filterKeysLookupTable) as Array<SearchBarFilterType>){
            if(filterKeysLookupTable[filterType].includes(filterKey)){
                filter = filterType
            }
        }

        filterEl.setText(filter)
        this.activeFilter = filter

        switch(filter){
            case 'default':
                filterEl.toggleClass('hide', true)
                this.fileSuggester = this.createDefaultSuggester()
                this.fileSuggester.setInput('')
                break;
            case 'omnisearch':
                if(this.isOmnisearchAvailable()){
                    filterEl.toggleClass('hide', false)
                    this.fileSuggester = new OmnisearchSuggester(this.plugin.app, this.plugin, this.view, this)
                    this.fileSuggester.setInput('')
                }
                else{
                    new Notice('Omnisearch is not available.')
                    this.updateActiveSuggester('default')
                }
                break;
            case 'fileExtension':
            case 'fileType':
                this.fileSuggester = new HomeTabFileSuggester(this.plugin.app, this.plugin, this.view, this)
                this.fileSuggester.setFileFilter(filterKey as FileType | FileExtension)
                filterEl.toggleClass('hide', false)
                filterEl.setText(filterKey)
                this.fileSuggester.setInput('')
                break;
            default:
                break;
        }     
    }
}
