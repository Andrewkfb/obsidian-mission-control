import { Notice, Plugin } from 'obsidian';
import { HomeTabView, VIEW_TYPE } from 'src/homeView';
import { HomeTabSettingTab, DEFAULT_SETTINGS, type HomeTabSettings } from './settings'
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
		this.recentFileManager?.unload()
		this.bookmarkedFileManager?.unload()
		this.taskIndex?.unload()
	}

	async loadSettings(): Promise<void> {
		const saved = await this.loadData() as Partial<HomeTabSettings> | null
		this.settings = {
			...DEFAULT_SETTINGS,
			...saved,
			logo: { ...DEFAULT_SETTINGS.logo, ...saved?.logo },
		}
	}

	saveSettings(): void {
		pluginSettingsStore.set(this.settings)
		void this.saveData(this.settings)
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
