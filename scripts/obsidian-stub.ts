// Minimal stand-in for the Obsidian runtime, enough to render components in node.
export class TFile { path = ''; basename = ''; extension = 'md'; stat = { mtime: 0 } }
export class TFolder { path = ''; children: unknown[] = [] }
export class TAbstractFile { path = '' }
export class Menu {
    addItem(_cb: unknown) { return this }
    addSeparator() { return this }
    setUseNativeMenu(_v: unknown) { return this }
    showAtMouseEvent(_e: unknown) { return this }
}
export class Notice { constructor(_m?: string, _t?: number) {} }
export const setIcon = (_el: unknown, _icon: string) => {}
export const debounce = (fn: (...a: unknown[]) => unknown) => Object.assign(fn, { cancel: () => {}, run: () => {} })
export const normalizePath = (p: string) => p
export const getAllTags = () => []
export const Keymap = { isModEvent: () => false }
export const Platform = { isMobile: false }
export class Component {}
export class Scope {}
export type App = unknown
export type PaneType = unknown
export type EventRef = unknown
export type CachedMetadata = unknown
export type Vault = unknown
export class Setting {
    settingEl = {} as unknown
    controlEl = {} as unknown
    setName(_v: unknown) { return this }
    setDesc(_v: unknown) { return this }
    setHeading() { return this }
    addText(_cb: unknown) { return this }
    addToggle(_cb: unknown) { return this }
    addSlider(_cb: unknown) { return this }
    addDropdown(_cb: unknown) { return this }
    addbutt(_cb: unknown) { return this }
}
export class PluginSettingTab { constructor(_app?: unknown, _plugin?: unknown) {} }
export class Plugin {}
export class Modal { constructor(_app?: unknown) {} }
export class FuzzySuggestModal { constructor(_app?: unknown) {} }
export class SuggestModal { constructor(_app?: unknown) {} }
export class FileView {}
export class WorkspaceLeaf {}
export const getLinkpath = (p: string) => p
export const parseFrontMatterAliases = () => null
export const prepareFuzzySearch = () => () => null
