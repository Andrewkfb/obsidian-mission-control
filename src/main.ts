import { debounce, Notice, Plugin } from 'obsidian';
import { HomeTabView, VIEW_TYPE } from 'src/homeView';
import { HomeTabSettingTab, DEFAULT_SETTINGS, type HomeTabSettings } from './settings'
import { mergeTabAdditions } from './utils/tabs'
import { pluginSettingsStore, bookmarkedFiles } from './store'
import { RecentFileManager } from './recentFiles';
import { BookmarkedFileManager } from './bookmarkedFiles';
import { TaskIndex } from './tasks/TaskIndex';

export default class MissionControlPlugin extends Plugin {
	settings!: HomeTabSettings;
	recentFileManager!: RecentFileManager
	bookmarkedFileManager?: BookmarkedFileManager
	taskIndex!: TaskIndex
	
	async onload() {
		await this.loadSettings()
		this.addSettingTab(new HomeTabSettingTab(this.app, this))
		this.registerView(VIEW_TYPE, (leaf) => new HomeTabView(leaf, this))

		this.registerEvent(this.app.workspace.on('layout-change', () => this.onLayoutChange()))
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if(leaf?.view instanceof HomeTabView) leaf.view.searchBar.focusSearchbar()
		}))

		this.addRibbonIcon('home', 'Mission control', () => this.activateView(false, true))

		pluginSettingsStore.set(this.settings)
		this.recentFileManager = new RecentFileManager(this.app, this)
		this.recentFileManager.load()

		this.taskIndex = new TaskIndex(this.app, this)
		this.taskIndex.load()

		this.addCommand({
			id: 'open-new-tab',
			name: 'Open new tab',
			callback: () => this.activateView(false, true)})
		this.addCommand({
			id: 'replace-current-tab',
			name: 'Replace current tab',
			callback: () => this.activateView(true)})

		this.app.workspace.onLayoutReady(() => {
			if(this.app.internalPlugins.getPluginById('bookmarks')){
				this.bookmarkedFileManager = new BookmarkedFileManager(this.app, this, bookmarkedFiles)
				this.bookmarkedFileManager.load()
			}

			if(this.settings.omnisearch && !this.app.plugins.getPlugin('omnisearch') && !this.settings.notifiedOmnisearchMissing){
				new Notice('Mission control: install omnisearch for full-text search. Fuzzy fallback active.', 8000)
				this.settings.notifiedOmnisearchMissing = true
				this.saveSettings()
			}

			if(this.settings.newTabOnStart){
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE)
				if(leaves.length > 0){
					void this.app.workspace.revealLeaf(leaves[0])
					leaves.forEach((leaf, index) => { if(index > 0) leaf.detach() })
				} else {
					this.activateView(false, true)
				}
				if(this.settings.closePreviousSessionTabs){
					const leafTypes: string[] = []
					this.app.workspace.iterateRootLeaves((leaf) => {
						const t = leaf.view.getViewType()
						if(!leafTypes.includes(t) && t !== VIEW_TYPE) leafTypes.push(t)
					})
					leafTypes.forEach((type) => this.app.workspace.detachLeavesOfType(type))
				}
			}
		})
	}

	onunload(): void {
		// Flush a pending debounced save before the plugin goes away.
		this.queuedSave.run()
		this.recentFileManager?.unload()
		this.bookmarkedFileManager?.unload()
		this.taskIndex?.unload()
	}

	async loadSettings(): Promise<void> {
		const saved = await this.loadData() as Partial<HomeTabSettings> | null
		// A saved `activeTabs` predates any tab added since, so merge those in
		// rather than letting an upgrade hide them. See mergeTabAdditions.
		const tabs = mergeTabAdditions(saved?.activeTabs, saved?.mergedTabAdditions, DEFAULT_SETTINGS.activeTabs)
		this.settings = {
			...DEFAULT_SETTINGS,
			...saved,
			logo: { ...DEFAULT_SETTINGS.logo, ...saved?.logo },
			activeTabs: tabs.activeTabs,
			mergedTabAdditions: tabs.mergedTabAdditions,
		}
	}

	/**
	 * Persist immediately. For user-initiated, infrequent changes — the settings
	 * tab, where a change should survive quitting Obsidian a moment later.
	 */
	saveSettings(): void {
		pluginSettingsStore.set(this.settings)
		this.queuedSave.cancel()
		void this.writeSettings()
	}

	/**
	 * Persist on a debounce. For bookkeeping that rides on ordinary navigation:
	 * the recent-files list updates on every `file-open`, and each save
	 * serializes the whole settings object — including the recent and bookmarked
	 * file stores — back to data.json. Flipping through ten notes should not mean
	 * ten full writes.
	 */
	queueSaveSettings(): void {
		pluginSettingsStore.set(this.settings)
		this.queuedSave()
	}

	// resetTimer: false — fire 1s after the *first* save in a burst, so continuous
	// activity still gets written rather than being starved indefinitely.
	private queuedSave = debounce(() => void this.writeSettings(), 1000, false)

	/** Chain writes so two saves can never interleave mid-write. */
	private writeChain: Promise<void> = Promise.resolve()
	private writeSettings(): Promise<void> {
		this.writeChain = this.writeChain
			.then(() => this.saveData(this.settings))
			.catch((err) => console.error('Mission Control: could not save settings', err))
		return this.writeChain
	}

	private onLayoutChange(): void{
		if(!this.settings.replaceNewTabs) return
		// Iterate all root leaves and replace any that are still empty.
		// getMostRecentLeaf() is unreliable here — it often returns the
		// previously-active leaf rather than the newly-created empty one.
		this.app.workspace.iterateRootLeaves((leaf) => {
			if(leaf.getViewState().type === 'empty'){
				void leaf.setViewState({ type: VIEW_TYPE })
			}
		})
	}

	public activateView(overrideView?: boolean, openNewTab?: boolean):void {
		if(openNewTab){
			const leaf = this.app.workspace.getLeaf('tab')
			void leaf.setViewState({ type: VIEW_TYPE })
			void this.app.workspace.revealLeaf(leaf)
			return
		}
		const leaf = this.app.workspace.getMostRecentLeaf()
		if(leaf && (overrideView || leaf.getViewState().type === 'empty')){
			void leaf.setViewState({ type: VIEW_TYPE })
		}
	}

	public refreshOpenViews(): void {
		this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => leaf.rebuildView())
	}
}
