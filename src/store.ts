import { writable } from 'svelte/store'
import type { HomeTabSettings } from './settings'
import type { RecentFile } from './recentFiles'
import type { BookmarkedFile } from './bookmarkedFiles'
import type { Task } from './tasks/Task'

export const pluginSettingsStore = writable<HomeTabSettings>()
export const bookmarkedFiles = writable<BookmarkedFile[]>([])
export const recentFiles = writable<RecentFile[]>([])
export const tasks = writable<Task[]>([])
// Map: source file path -> set of note-level tags (frontmatter + body), without the leading '#'.
// Published by TaskIndex; used by the dashboard tag filter and the settings whitelist UI.
export const noteTagsByPath = writable<Map<string, Set<string>>>(new Map())
