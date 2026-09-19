import { Component, TFile, TFolder, TAbstractFile, normalizePath, getAllTags, type App, type CachedMetadata } from 'obsidian'
import type HomeTab from '../main'
import type { Task } from './Task'
import { parseTasks } from './TaskParser'
import { isInFolder } from '../utils/paths'
import { tasks as tasksStore, noteTagsByPath as noteTagsStore } from '../store'

/**
 * Watches the configured source folder, parses tasks per file, and keeps a
 * flat task list published to the `tasks` svelte store. Re-parses only the
 * file that changed, debounced so a typing burst doesn't thrash the UI.
 *
 * Also tracks note-level tags (frontmatter + body) per source file and
 * publishes them to `noteTagsByPath`, which powers the dashboard tag filter.
 */
export class TaskIndex extends Component {
    private app: App
    private plugin: HomeTab
    private byPath: Map<string, Task[]> = new Map()
    private tagsByPath: Map<string, Set<string>> = new Map()
    private flushTimer: number | null = null

    constructor(app: App, plugin: HomeTab) {
        super()
        this.app = app
        this.plugin = plugin
    }

    onload(): void {
        // `metadataCache.changed` fires once a file has been indexed and hands us
        // both its content and its parsed cache. That makes it a strict
        // improvement over listening to `vault.on('modify')` as well: the two
        // fired for the same edit, costing a second read and parse each time, and
        // the metadata event is the one that guarantees the tag cache is current.
        // It also covers newly created files, so 'create' is redundant.
        this.registerEvent(this.app.metadataCache.on('changed', (file, data, cache) => this.onFileIndexed(file, data, cache)))
        this.registerEvent(this.app.vault.on('delete', (file) => this.onFileDeleted(file)))
        // Documented not to fire on 'changed', so it has to come from the vault.
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.onFileRenamed(file, oldPath)))

        this.app.workspace.onLayoutReady(() => this.rebuild())
    }

    onunload(): void {
        this.byPath.clear()
        this.tagsByPath.clear()
        if (this.flushTimer !== null) window.clearTimeout(this.flushTimer)
    }

    /** Full rescan of the source folder. Call after the folder setting changes. */
    async rebuild(): Promise<void> {
        this.byPath.clear()
        this.tagsByPath.clear()
        const root = this.root
        const folder = root ? this.app.vault.getFolderByPath(root) : null
        if (!folder) {
            this.flush()
            return
        }

        const files: TFile[] = []
        const collectMarkdownFiles = (source: TFolder): void => {
            for (const child of source.children) {
                if (child instanceof TFile && child.extension === 'md') files.push(child)
                else if (child instanceof TFolder) collectMarkdownFiles(child)
            }
        }
        collectMarkdownFiles(folder)
        await Promise.all(files.map(f => this.indexFile(f)))
        this.flush()
    }

    private get root(): string | null {
        const raw = this.plugin.settings.taskSourceFolder
        if (!raw) return null
        return normalizePath(raw)
    }

    private inScope(path: string): boolean {
        return isInFolder(path, this.root ?? '')
    }

    /**
     * Index a file from content and metadata we already hold. The
     * `metadataCache.changed` event supplies both, so the hot path costs no
     * vault read and no cache lookup.
     */
    private indexContent(file: TFile, content: string, cache: CachedMetadata | null): void {
        const parsed = parseTasks(content, file.path, file.basename)
        if (parsed.length > 0) this.byPath.set(file.path, parsed)
        else this.byPath.delete(file.path)

        const tags = this.readNoteTags(cache)
        if (tags.size > 0) this.tagsByPath.set(file.path, tags)
        else this.tagsByPath.delete(file.path)
    }

    /** Read a file, then index it. Used by the full rescan and by renames. */
    private async indexFile(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.cachedRead(file)
            this.indexContent(file, content, this.app.metadataCache.getFileCache(file))
        } catch {
            this.byPath.delete(file.path)
            this.tagsByPath.delete(file.path)
        }
    }

    /** Pull note-level tags from a metadata cache (frontmatter + body), stripped of '#'. */
    private readNoteTags(cache: CachedMetadata | null): Set<string> {
        const out = new Set<string>()
        if (!cache) return out
        for (const t of getAllTags(cache) ?? []) out.add(t.replace(/^#/, ''))
        return out
    }

    private onFileIndexed(file: TFile, data: string, cache: CachedMetadata): void {
        if (file.extension !== 'md' || !this.inScope(file.path)) return
        this.indexContent(file, data, cache)
        this.scheduleFlush()
    }

    private onFileDeleted(file: TAbstractFile): void {
        const hadTasks = this.byPath.delete(file.path)
        const hadTags = this.tagsByPath.delete(file.path)
        if (hadTasks || hadTags) this.scheduleFlush()
    }

    private onFileRenamed(file: TAbstractFile, oldPath: string): void {
        const hadTasks = this.byPath.delete(oldPath)
        const hadTags = this.tagsByPath.delete(oldPath)
        if (file instanceof TFile && file.extension === 'md' && this.inScope(file.path)) {
            void this.indexFile(file).then(() => this.scheduleFlush())
        } else if (hadTasks || hadTags) {
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
        // Publish a new Map reference so Svelte detects the change.
        noteTagsStore.set(new Map(this.tagsByPath))
    }
}
