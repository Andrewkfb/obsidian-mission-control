import { Component, Notice, TAbstractFile, TFile, type App, type BookmarkItem, type BookmarksPlugin } from "obsidian";
import { get, type Writable } from "svelte/store";
import type HomeTab from "./main";
import type { LucideIcon } from "./utils/lucideIcons";

export interface BookmarkedFileStore {
    filepath: string
    iconId: LucideIcon | undefined
}
export interface BookmarkedFile {
    file: TFile
    iconId: LucideIcon | undefined
}

export class BookmarkedFileManager extends Component {
    private app: App
    private plugin: HomeTab
    private bookmarkedFilesStore: Writable<BookmarkedFile[]>

    constructor(app: App, plugin: HomeTab, bookmarkedFilesStore: Writable<BookmarkedFile[]>){
        super()

        this.app = app
        this.plugin = plugin
        this.bookmarkedFilesStore = bookmarkedFilesStore
    }

    onload(): void{
        // Load stored bookmarked files, then check if they've changed
        this.loadStoredBookmarkedFiles()
        this.updateBookmarkedFiles()
        // Update stored bookmarked files list when a file is bookmarked or unbookmarked
        const bookmarks = this.app.internalPlugins.getPluginById('bookmarks')
        if (bookmarks) this.registerEvent(bookmarks.instance.on('changed', () => this.updateBookmarkedFiles()))
    }

    private updateBookmarkedFiles(): void{
        const bookmarkedFiles = this.getBookmarkedFiles()
        
        this.bookmarkedFilesStore.update((filesArray) => {
            const updatedArray: BookmarkedFile[] = []

            bookmarkedFiles.forEach((bookmarkedFile) => {
                updatedArray.push({
                    file: bookmarkedFile,
                    // Retrieve icon from stored array
                    iconId: filesArray.find((item) => item.file === bookmarkedFile)?.iconId ?? undefined
                })
            })
            
            return updatedArray
        })

        this.storeBookmarkedFiles()
    }

    public updateFileIcon(file: TFile, iconId: LucideIcon): void{
        this.bookmarkedFilesStore.update((filesArray) => {
            return filesArray.map(item => item.file === file ? { ...item, iconId } : item)
        })

        this.storeBookmarkedFiles()
    }

    private getBookmarkedFiles(): TFile[]{
        if(this.app.internalPlugins.getPluginById('bookmarks')){
            const bookmarkedItems = this.app.internalPlugins.plugins.bookmarks.instance.getBookmarks()
            const bookmarkedFiles: TFile[] = []
    
            bookmarkedItems.forEach((item: BookmarkItem) => {
                if (item.type === 'file'){
                    const file = this.app.vault.getAbstractFileByPath(item.path)
                    if (file instanceof TFile){
                        bookmarkedFiles.push(file)
                    }
                }
            })
            return bookmarkedFiles
        }
        return []
    }

    private storeBookmarkedFiles(): void{
        if(this.app.internalPlugins.getPluginById('bookmarks')){
            const storeObj: BookmarkedFileStore[] = []
            get(this.bookmarkedFilesStore).forEach((item) => storeObj.push({
                filepath: item.file.path, // Store only the path instead of the entire TFile instance
                iconId: item.iconId
            }))
            this.plugin.settings.bookmarkedFileStore = storeObj
            this.plugin.saveSettings()
        }
    }

    private loadStoredBookmarkedFiles(): void{
        if(this.app.internalPlugins.getPluginById('bookmarks')){
            const filesToLoad: BookmarkedFile[] = []
            this.app.workspace.onLayoutReady(() => {
                this.plugin.settings.bookmarkedFileStore.forEach((item) => {
                    const file: TAbstractFile | null = this.app.vault.getAbstractFileByPath(item.filepath)
                    if(file && file instanceof TFile){
                        filesToLoad.push({
                            file: file,
                            iconId: item.iconId
                        })
                    }
                })
                this.bookmarkedFilesStore.set(filesToLoad)   
            })
        }
    }

    public removeBookmark = (file: TFile) => {
        const bookmarksPlugin: BookmarksPlugin | undefined = this.app.internalPlugins.getPluginById('bookmarks')
        if(bookmarksPlugin){
            const item: BookmarkItem | undefined = bookmarksPlugin.instance.getBookmarks().find(item => item.path === file.path)
            if(item) bookmarksPlugin.instance.removeItem(item)
        }
        else{
            new Notice("Bookmarks plugin is not enabled")
        }
    }
}
