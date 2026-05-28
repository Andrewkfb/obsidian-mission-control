import { Component, TFile, TAbstractFile, normalizePath, type App } from 'obsidian'
import type HomeTab from '../main'
import type { Task } from './Task'
import { parseTasks } from './TaskParser'
import { tasks as tasksStore } from '../store'

/**
 * Watches the configured source folder, parses tasks per file, and keeps a
 * flat task list published to the `tasks` svelte store. Re-parses only the
 * file that changed, debounced so a typing burst doesn't thrash the UI.
 */
export class TaskIndex extends Component {
    private app: App
    private plugin: HomeTab
    private byPath: Map<string, Task[]> = new Map()
    private flushTimer: number | null = null

    constructor(app: App, plugin: HomeTab) {
        super()
        this.app = app
        this.plugin = plugin
    }

    onload(): void {
        this.registerEvent(this.app.vault.on('modify', (file) => this.onFileChanged(file)))
        this.registerEvent(this.app.vault.on('create', (file) => this.onFileChanged(file)))
        this.registerEvent(this.app.vault.on('delete', (file) => this.onFileDeleted(file)))
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.onFileRenamed(file, oldPath)))

        this.app.workspace.onLayoutReady(() => this.rebuild())
    }

    onunload(): void {
        this.byPath.clear()
        if (this.flushTimer !== null) window.clearTimeout(this.flushTimer)
    }

    /** Full rescan of the source folder. Call after the folder setting changes. */
    async rebuild(): Promise<void> {
        this.byPath.clear()
        const files = this.app.vault.getMarkdownFiles().filter(f => this.inScope(f.path))
        await Promise.all(files.map(f => this.indexFile(f)))
        this.flush()
    }

    private get root(): string {
        return normalizePath(this.plugin.settings.taskSourceFolder || '/')
    }

    private inScope(path: string): boolean {
        const root = this.root
        if (root === '/' || root === '') return true
        return path === root || path.startsWith(root + '/')
    }

    private async indexFile(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.cachedRead(file)
            const parsed = parseTasks(content, file.path, file.basename)
            if (parsed.length > 0) this.byPath.set(file.path, parsed)
            else this.byPath.delete(file.path)
        } catch {
            this.byPath.delete(file.path)
        }
    }

    private onFileChanged(file: TAbstractFile): void {
        if (file instanceof TFile && file.extension === 'md' && this.inScope(file.path)) {
            this.indexFile(file).then(() => this.scheduleFlush())
        }
    }

    private onFileDeleted(file: TAbstractFile): void {
        if (this.byPath.delete(file.path)) this.scheduleFlush()
    }

    private onFileRenamed(file: TAbstractFile, oldPath: string): void {
        const had = this.byPath.delete(oldPath)
        if (file instanceof TFile && file.extension === 'md' && this.inScope(file.path)) {
            this.indexFile(file).then(() => this.scheduleFlush())
        } else if (had) {
            this.scheduleFlush()
        }
    }

    private scheduleFlush(): void {
        if (this.flushTimer !== null) window.clearTimeout(this.flushTimer)
        this.flushTimer = window.setTimeout(() => this.flush(), 50)
    }

    private flush(): void {
        this.flushTimer = null
        const all: Task[] = []
        for (const list of this.byPath.values()) all.push(...list)
        tasksStore.set(all)
    }
}
