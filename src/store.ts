import { writable } from 'svelte/store'
import type { HomeTabSettings } from './settings'
import type { recentFile } from './recentFiles'
import type { bookmarkedFile } from './bookmarkedFiles'
import type { Task } from './tasks/Task'

export const pluginSettingsStore = writable<HomeTabSettings>()
export const bookmarkedFiles = writable<bookmarkedFile[]>()
export const recentFiles = writable<recentFile[]>([])
export const tasks = writable<Task[]>([])