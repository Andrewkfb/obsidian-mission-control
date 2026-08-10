import { Platform, TFile, View, type App } from 'obsidian'
import type HomeTab from '../main'
import type HomeTabSearchBar from "src/homeTabSearchbar"
import { TextInputSuggester } from './suggester'
import { get } from 'svelte/store'
import OmnisearchSuggestion from 'src/ui/svelteComponents/omnisearchSuggestion.svelte'

export type OmnisearchApi = {
    // Returns a promise that will contain the same results as the Vault modal
    search: (query: string) => Promise<ResultNoteApi[]>,
    // Refreshes the index
    refreshIndex: () => Promise<void>
    // Register a callback that will be called when the indexing is done
    registerOnIndexed: (callback: () => void) => void,
    // Unregister a callback that was previously registered
    unregisterOnIndexed: (callback: () => void) => void,
  }
export type ResultNoteApi = {
    score: number
    path: string
    excerpt: string
    basename: string
    foundWords: string[]
    matches: SearchMatchApi[]
}
export type SearchMatchApi = {
    match: string
    offset: number
}

declare global {
    interface Window {
        omnisearch?: OmnisearchApi
    }
}

export default class OmnisearchSuggester extends TextInputSuggester<ResultNoteApi>{
    // private files: SearchFile[]
    private omnisearch: OmnisearchApi

    private view: View
    private plugin: HomeTab
    constructor(app: App, plugin: HomeTab, view: View, searchBar: HomeTabSearchBar) {
        super(app, get(searchBar.searchBarEl), get(searchBar.suggestionContainerEl), {
                containerClass: `home-tab-suggestion-container ${Platform.isPhone ? 'is-phone' : ''}`,
                additionalClasses: `${plugin.settings.selectionHighlight === 'accentColor' ? 'use-accent-color' : ''}`,
                shortcuts: plugin.settings.showShortcuts ? [
                    {hotkey: '↑↓', action: 'to navigate'},
                    {hotkey: '↵', action: 'to open'},
                    {hotkey: 'ctrl ↵', action: 'to open in new tab'},
                    {hotkey: 'esc', action: 'to dismiss'},
                ] : undefined
                }, plugin.settings.searchDelay)
        this.plugin = plugin
        this.view = view
        const omnisearch = window.omnisearch
        if (!omnisearch) throw new Error('Omnisearch API is unavailable')
        this.omnisearch = omnisearch

        // Open file in new tab
        this.scope.register(['Mod'], 'Enter', (e) => {
            e.preventDefault()
            this.useSelectedItem(this.suggester.getSelectedItem(), true)
        })
    }

    updateSearchBarContainerEl(isActive: boolean){
        this.inputEl.parentElement?.toggleClass('is-active', isActive)
    }

    onOpen(): void {
        this.updateSearchBarContainerEl(this.suggester.getSuggestions().length > 0 ? true : false)    
    }

    onClose(): void {
        this.updateSearchBarContainerEl(false)
    }

    async getSuggestions(input: string): Promise<ResultNoteApi[]> {
        const suggestions = (await this.omnisearch.search(input)).splice(0, this.plugin.settings.maxResults)
        return suggestions
    }

    useSelectedItem(selectedItem: ResultNoteApi, newTab?: boolean): void {
        const file = this.app.vault.getAbstractFileByPath(selectedItem.path)
        if(file && file instanceof TFile){
            this.openFile(file, newTab)
        }
    }

    
    getDisplayElementProps(suggestion: ResultNoteApi): {basename: string, excerpt: string}{
        return {
            basename: suggestion.basename,
            excerpt: this.plugin.settings.showOmnisearchExcerpt ? suggestion.excerpt : '',
        }
    }

    getDisplayElementComponentType(): typeof OmnisearchSuggestion{
        return OmnisearchSuggestion
    }

    openFile(file: TFile, newTab?: boolean): void{
        if(newTab){
            void this.app.workspace.createLeafInTabGroup().openFile(file)
        }
        else{
            void this.view.leaf.openFile(file)
        }
    }
}
