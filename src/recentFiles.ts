import { Component, type App, TFile, TAbstractFile } from "obsidian";
import { get } from "svelte/store";
import type HomeTab from "./main";
import type { HomeTabSettings } from "./settings";
import { recentFiles } from "./store";

export interface RecentFile {
    file: TFile,
    timestamp: number,
}

export interface RecentFileStore {
    filepath: string,
    timestamp: number,
}

export class RecentFileManager extends Component{
    private app: App
    private plugin: HomeTab
    private pluginSettings: HomeTabSettings

    constructor(app: App, plugin: HomeTab){
        super()
        this.app = app
        this.plugin = plugin
        this.pluginSettings = plugin.settings
    }
    
    onload(): void {
        this.registerEvent(this.app.workspace.on('file-open', (file) => {
            this.updateRecentFiles(file)
            this.storeRecentFiles()
        }))
        this.registerEvent(this.app.vault.on('delete', (file) => {
            if (file instanceof TFile) this.removeRecentFile(file)
        }))
        this.registerEvent(this.app.vault.on('rename', (file) => {
            if (file instanceof TFile) this.onFileRename()
        }))

        this.loadStoredRecentFiles()
    }

    private updateRecentFiles(openedFile: TFile | null): void{
        if(openedFile){
            recentFiles.update(files => [
                { file: openedFile, timestamp: Date.now() },
                ...files.filter(item => item.file !== openedFile),
            ].slice(0, this.pluginSettings.maxRecentFiles))
        }
    }
    
    removeRecentFile(file: TFile): void{
        recentFiles.update(files => files.filter(item => item.file !== file))
        this.storeRecentFiles()
    }

    onNewMaxListLength(newValue: number): void {
        if(newValue < get(recentFiles).length) recentFiles.update(files => files.slice(0, newValue))
        this.storeRecentFiles()
    }

    private onFileRename(): void{
        recentFiles.update(files => [...files])
    }

    private storeRecentFiles(): void{
        if(this.plugin.settings.storeRecentFile){
            const storeObj: RecentFileStore[] = []
            get(recentFiles).forEach((item) => storeObj.push({
                filepath: item.file.path, // Store only the path instead of the entire TFile instance
                timestamp: item.timestamp
            }))
            this.plugin.settings.recentFilesStore = storeObj
            this.plugin.saveSettings()
        }
    }

    private loadStoredRecentFiles(): void{
        if(this.plugin.settings.storeRecentFile){
            const filesToLoad: RecentFile[] = []
            this.app.workspace.onLayoutReady(() => { 
                this.plugin.settings.recentFilesStore.forEach((item) => {
                    const file: TAbstractFile | null = this.app.vault.getAbstractFileByPath(item.filepath)
                    if(file && file instanceof TFile){
                        filesToLoad.push({
                            file: file,
                            timestamp: item.timestamp
                        })
                    }
                })
                recentFiles.set(filesToLoad.sort((a, b) => b.timestamp - a.timestamp).slice(0, this.pluginSettings.maxRecentFiles))
            })
        }
    }

}
