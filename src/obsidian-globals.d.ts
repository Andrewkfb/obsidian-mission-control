import 'obsidian'

declare module 'obsidian' {
	interface App {
		internalPlugins: {
			getPluginById(id: string): BookmarksPlugin | undefined
			plugins: { bookmarks: BookmarksPlugin }
		}
		plugins: { getPlugin(id: string): Plugin | undefined }
		dom: { appContainerEl: HTMLElement }
	}

	interface BookmarksPlugin extends Plugin {
		instance: {
		on(name: 'changed', callback: () => void): import('obsidian').EventRef
			getBookmarks(): BookmarkItem[]
			removeItem(item: BookmarkItem): void
		}
	}

	interface BookmarkItem {
		type: string
		title?: string
		path: string
	}

	interface Vault {
		config: { nativeMenus: boolean }
	}

	interface Workspace {
		createLeafInTabGroup(): WorkspaceLeaf
	}

	interface WorkspaceLeaf {
		rebuildView(): void
	}

	interface TFile {
		deleted: boolean
	}
}

export {}
