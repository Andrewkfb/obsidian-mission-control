import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { EmbeddedHomeTab, HomeTabView, VIEW_TYPE } from 'src/homeView';
import { HomeTabSettingTab, DEFAULT_SETTINGS, type HomeTabSettings } from './settings'
import { pluginSettingsStore, bookmarkedFiles } from './store'
import { RecentFileManager } from './recentFiles';
import { bookmarkedFilesManager } from './bookmarkedFiles';
import { TaskIndex } from './tasks/TaskIndex';

declare module 'obsidian'{
	interface App{
		internalPlugins: InternalPlugins
		plugins: Plugins
		dom: any
		isMobile: boolean
	}
	interface InternalPlugins{
		getPluginById: Function
		plugins: {
			bookmarks: BookmarksPlugin
		}
	}
	interface Plugins{
		getPlugin: (id: string) => Plugin
	}
	interface BookmarksPlugin extends Plugin{
		instance: {
			items: BookmarkItem[]
			getBookmarks: () => BookmarkItem[]
			removeItem: (item: BookmarkItem) => void
		}
	}
	interface BookmarkItem{
		type: string,
		title: string | undefined,
		path: string
	}
	interface config{
		nativeMenus: boolean
	}
	interface Vault{
		config: config
	}
	interface Workspace{
		createLeafInTabGroup: Function
	}
	interface WorkspaceLeaf{
		rebuildView: Function
		activeTime: number
		app: App
	}
	interface TFile{
		deleted: boolean
	}
}

export default class HomeTab extends Plugin {
	settings: HomeTabSettings;
	recentFileManager: RecentFileManager
	bookmarkedFileManager: bookmarkedFilesManager
	taskIndex: TaskIndex
	activeEmbeddedHomeTabViews: EmbeddedHomeTab[]
	
	async onload() {
		// ── STEP 0: visible popup diagnostic — tells us the new code is running ──
		// Remove this notice once the plugin is stable.
		new Notice('MC step 0: onload started', 3000)
		console.log('MC step 0: onload started')

		try { await this.loadSettings() } catch(e) { new Notice(`MC CRASH loadSettings: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 1: settings loaded', 2000)

		try { this.addSettingTab(new HomeTabSettingTab(this.app, this)) } catch(e) { new Notice(`MC CRASH addSettingTab: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 2: settingTab added', 2000)

		try { this.registerView(VIEW_TYPE, (leaf) => new HomeTabView(leaf, this)) } catch(e) { new Notice(`MC CRASH registerView: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 3: view registered', 2000)

		try {
			this.registerEvent(this.app.workspace.on('layout-change', () => this.onLayoutChange()))
			this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf) => {if(leaf.view instanceof HomeTabView){leaf.view.searchBar.focusSearchbar()}}))
		} catch(e) { new Notice(`MC CRASH events: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 4: events registered', 2000)

		try { this.addRibbonIcon('home', 'Mission Control', () => this.activateView(false, true)) } catch(e) { new Notice(`MC CRASH ribbon: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 5: ribbon added', 2000)

		try { pluginSettingsStore.set(this.settings) } catch(e) { new Notice(`MC CRASH store.set: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 6: store set', 2000)

		this.activeEmbeddedHomeTabViews = []

		try { this.recentFileManager = new RecentFileManager(app, this); this.recentFileManager.load() } catch(e) { new Notice(`MC CRASH recentFileManager: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 7: recentFileManager loaded', 2000)

		try { this.taskIndex = new TaskIndex(app, this); this.taskIndex.load() } catch(e) { new Notice(`MC CRASH taskIndex: ${String(e)}`, 15000); console.error(e); throw e }
		new Notice('MC step 8: taskIndex loaded', 2000)

		this.addCommand({
			id: 'open-new-mission-control-tab',
			name: 'Open new Mission Control tab',
			callback: () => this.activateView(false, true)})
		this.addCommand({
			id: 'open-mission-control-tab',
			name: 'Replace current tab with Mission Control',
			callback: () => this.activateView(true)})

		this.app.workspace.onLayoutReady(() => {
			try {
				new Notice('MC step 9: onLayoutReady fired', 2000)

				if(this.app.internalPlugins.getPluginById('bookmarks')){
					this.bookmarkedFileManager = new bookmarkedFilesManager(app, this, bookmarkedFiles)
					this.bookmarkedFileManager.load()
				}
				new Notice('MC step 10: bookmarks done', 2000)

				if(this.settings.omnisearch && !this.app.plugins.getPlugin('omnisearch') && !this.settings.notifiedOmnisearchMissing){
					new Notice('Mission Control: install Omnisearch for full-text search. Fuzzy fallback active.', 8000)
					this.settings.notifiedOmnisearchMissing = true
					this.saveSettings()
				}

				// search-bar code block skipped for v1
				new Notice('MC step 11: codeblock skipped', 2000)

				if(this.settings.newTabOnStart){
					new Notice('MC step 12: opening new tab...', 2000)
					const leaves = app.workspace.getLeavesOfType(VIEW_TYPE)
					if(leaves.length > 0){
						app.workspace.revealLeaf(leaves[0])
						leaves.forEach((leaf, index) => { if(index > 0) leaf.detach() })
					} else {
						this.activateView(false, true)
					}
					if(this.settings.closePreviousSessionTabs){
						const leafTypes: string[] = []
						app.workspace.iterateRootLeaves((leaf) => {
							const t = leaf.view.getViewType()
							if(!leafTypes.includes(t) && t !== VIEW_TYPE) leafTypes.push(t)
						})
						leafTypes.forEach((type) => app.workspace.detachLeavesOfType(type))
					}
				}

				new Notice('✅ MC fully loaded', 3000)
			} catch(e) {
				new Notice(`MC CRASH onLayoutReady: ${String(e)}`, 15000)
				console.error('MC crash in onLayoutReady:', e)
				throw e
			}
		})
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE)
		this.activeEmbeddedHomeTabViews?.forEach(view => view.unload())
		this.recentFileManager?.unload()
		this.bookmarkedFileManager?.unload()   // only assigned when Bookmarks core plugin is on
		this.taskIndex?.unload()
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
		pluginSettingsStore.update(() => this.settings)
	}

	private onLayoutChange(): void{
		if(!this.settings.replaceNewTabs) return
		// Iterate all root leaves and replace any that are still empty.
		// getMostRecentLeaf() is unreliable here — it often returns the
		// previously-active leaf rather than the newly-created empty one.
		this.app.workspace.iterateRootLeaves((leaf) => {
			if(leaf.getViewState().type === 'empty'){
				leaf.setViewState({ type: VIEW_TYPE })
			}
		})
	}

	public activateView(overrideView?: boolean, openNewTab?: boolean):void {
		if(openNewTab){
			const leaf = app.workspace.getLeaf('tab')
			leaf.setViewState({ type: VIEW_TYPE })
			app.workspace.revealLeaf(leaf)
			return
		}
		const leaf = app.workspace.getMostRecentLeaf()
		if(leaf && (overrideView || leaf.getViewState().type === 'empty')){
			leaf.setViewState({ type: VIEW_TYPE })
		}
	}

	public refreshOpenViews(): void {
		this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => leaf.rebuildView())
	}
}