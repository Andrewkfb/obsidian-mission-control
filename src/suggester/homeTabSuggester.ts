import type Fuse from 'fuse.js'
import { normalizePath, Platform, TAbstractFile, TFile, View, type App } from 'obsidian'
import { DEFAULT_FUSE_OPTIONS, FileFuzzySearch, type SearchFile } from './fuzzySearch'
import type HomeTab from '../main'
import type HomeTabSearchBar from "src/homeTabSearchbar"
import { generateSearchFile,  getParentFolderFromPath,  getSearchFiles, getUnresolvedMarkdownFiles } from 'src/utils/getFilesUtils'
import { TextInputSuggester } from './suggester'
import { isValidExtension, type FileExtension, type FileType } from 'src/utils/getFileTypeUtils'
import { get } from 'svelte/store'
import HomeTabFileSuggestion from 'src/ui/svelteComponents/homeTabFileSuggestion.svelte'

export default class HomeTabFileSuggester extends TextInputSuggester<Fuse.FuseResult<SearchFile>>{
    private files: SearchFile[] = []
    private fuzzySearch!: FileFuzzySearch

    private view: View
    private plugin: HomeTab
    private activeFilter: FileType | FileExtension | null = null

    constructor(app: App, plugin: HomeTab, view: View, searchBar: HomeTabSearchBar) {
        super(app, get(searchBar.searchBarEl), get(searchBar.suggestionContainerEl), {
                containerClass: `home-tab-suggestion-container ${Platform.isPhone ? 'is-phone' : ''}`,
                additionalClasses: `${plugin.settings.selectionHighlight === 'accentColor' ? 'use-accent-color' : ''}`,
                shortcuts: plugin.settings.showShortcuts ? [
                    {hotkey: '↑↓', action: 'to navigate'},
                    {hotkey: '↵', action: 'to open'},
                    {hotkey: 'shift ↵', action: 'to create'},
                    {hotkey: 'ctrl ↵', action: 'to open in new tab'},
                    {hotkey: 'esc', action: 'to dismiss'},
                ] : undefined
                }, plugin.settings.searchDelay)
        this.plugin = plugin
        this.view = view
        this.rebuildSearchIndex()

        // Open file in new tab
        this.scope.register(['Mod'], 'Enter', (e) => {
            e.preventDefault()
            this.useSelectedItem(this.suggester.getSelectedItem(), true)
        })
        // Create file
        this.scope.register(['Shift'], 'Enter', async(e) => {
            e.preventDefault()
            await this.handleFileCreation()
        })
        // Create file and open in new tab
        this.scope.register(['Shift', 'Mod'], 'Enter', async(e) => {
            e.preventDefault()
            await this.handleFileCreation(undefined, true)
        })

        this.view.registerEvent(this.app.vault.on('create', (file: TAbstractFile) => { if(file instanceof TFile){this.updateSearchfilesList(file)}}))
        this.view.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => { if(file instanceof TFile){this.updateSearchfilesList(file)}}))
        this.view.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => { if(file instanceof TFile){this.updateSearchfilesList(file, oldPath)}}))
        this.view.registerEvent(this.app.metadataCache.on('resolved', () => this.updateUnresolvedFiles()))
    }

    updateSearchBarContainerElState(isActive: boolean){
        this.inputEl.parentElement?.toggleClass('is-active', isActive)
    }

    private rebuildSearchIndex(): void {
        const files = getSearchFiles(this.app, this.plugin.settings.unresolvedLinks)
        this.files = this.plugin.settings.markdownOnly ? this.filterSearchFileArray('markdown', files) : files
        this.fuzzySearch = new FileFuzzySearch(this.files, {
            ...DEFAULT_FUSE_OPTIONS,
            ignoreLocation: true,
            fieldNormWeight: 1.65,
            keys: [{name: 'basename', weight: 1.5}, {name: 'aliases', weight: 0.1}],
        })
    }

    onOpen(): void {
        this.updateSearchBarContainerElState(this.suggester.getSuggestions().length > 0 ? true : false)    
    }

    onClose(): void {
        this.updateSearchBarContainerElState(false)
    }

    filterSearchFileArray(filterKey: FileType | FileExtension, fileArray: SearchFile[]): SearchFile[]{
        return fileArray.filter(file => isValidExtension(filterKey) ? file.extension === filterKey : file.fileType === filterKey)
    }

    updateUnresolvedFiles(){
        if (!this.plugin.settings.unresolvedLinks) return
        const unresolvedFiles = getUnresolvedMarkdownFiles(this.app)
        const knownPaths = new Set(this.files.map(file => file.path))
        const newFiles = unresolvedFiles.filter(file => !knownPaths.has(file.path))
        if (newFiles.length === 0) return
        this.files = [...this.files, ...newFiles]
        this.fuzzySearch.updateSearchArray(this.files)
    }

    updateSearchfilesList(file:TFile, oldPath?: string){
        if (oldPath) this.files = this.files.filter(item => item.path !== oldPath)
        if (file.deleted) {
            this.files = this.files.filter(item => item.path !== file.path)
        } else {
            const updated = generateSearchFile(this.app, file)
            const index = this.files.findIndex(item => item.path === file.path)
            if (index === -1) this.files = [...this.files, updated]
            else if (this.files[index].isUnresolved) {
                this.files = this.files.map((item, i) => i === index ? updated : item)
            }
        }
        this.fuzzySearch.updateSearchArray(this.files)
    }

    onNoSuggestion(): void {
        if(!this.activeFilter || this.activeFilter === 'markdown' || this.activeFilter === 'md'){
            const input = this.inputEl.value
            if (input) {
                this.suggester.setSuggestions([{
                        item: {
                            name: `${input}.md`,
                            path: `${input}.md`,
                            basename: input,
                            isCreated: false,
                            fileType: 'markdown',
                            extension: 'md',
                        },
                        refIndex: 0,
                        score: 0,
                }])
                this.open()
            }
            else{
                this.close()
            }
        }
        else{
            this.close()
        }
    }
    
    getSuggestions(input: string): Fuse.FuseResult<SearchFile>[] {
        return this.fuzzySearch.rawSearch(input, this.plugin.settings.maxResults)
    }

    useSelectedItem(selectedItem: Fuse.FuseResult<SearchFile>, newTab?: boolean): void {
        if(selectedItem.item.isCreated && selectedItem.item.file){
            this.openFile(selectedItem.item.file, newTab)
        }
        else{
            void this.handleFileCreation(selectedItem.item, newTab)
        }
    }

    getDisplayElementProps(suggestion: Fuse.FuseResult<SearchFile>): {nameToDisplay: string, filePath?: string}{
        const nameToDisplay = this.fuzzySearch.getBestMatch(suggestion, this.inputEl.value)
        let filePath: string | undefined = undefined
        if(this.plugin.settings.showPath){
            filePath = suggestion.item.file?.parent?.name ?? getParentFolderFromPath(suggestion.item.path)
        }
        
        return {
            nameToDisplay: nameToDisplay,
            filePath: filePath
        }
    }

    getDisplayElementComponentType(): typeof HomeTabFileSuggestion{
        return HomeTabFileSuggestion
    }

    async handleFileCreation(selectedFile?: SearchFile, newTab?: boolean): Promise<void>{
        let newFile: TFile
        
        if(selectedFile?.isUnresolved){
            const folderPath = normalizePath(selectedFile.path.replace(selectedFile.name, ''))
            if(folderPath && !this.app.vault.getFolderByPath(folderPath)){
                await this.app.vault.createFolder(folderPath)
            }
            newFile = await this.app.vault.create(selectedFile.path, '')
        }
        else{
            const input = this.inputEl.value;
            // If a file with the same filename exists open it
            // Mimics the behaviour of the default quick switcher
            const files = this.files.filter(file => file.fileType === 'markdown')
            if(files.map(file => file.basename).includes(input)){
                const fileToOpen = files.find(f => f.basename === input)?.file
                if(fileToOpen){
                    return this.openFile(fileToOpen, newTab)
                }
            }
            newFile = await this.app.vault.create(normalizePath(`${this.app.fileManager.getNewFileParent('').path}/${input}.md`), '')
        }
        
        
        this.openFile(newFile, newTab)
    }

    openFile(file: TFile, newTab?: boolean): void{
        if(newTab){
            void this.app.workspace.createLeafInTabGroup().openFile(file)
        }
        else{
            void this.view.leaf.openFile(file)
        }
    }

    setFileFilter(filterKey: FileType | FileExtension): void{
        this.activeFilter = filterKey
        
        const files = this.plugin.settings.markdownOnly
            ? this.filterSearchFileArray('markdown', getSearchFiles(this.app, this.plugin.settings.unresolvedLinks))
            : this.files
        this.fuzzySearch.updateSearchArray(this.filterSearchFileArray(filterKey, files))
        
        this.suggester.setSuggestions([]) // Reset search suggestions
        this.close()
    }
}
