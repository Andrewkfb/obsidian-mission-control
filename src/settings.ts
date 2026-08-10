import { App, Setting, PluginSettingTab, normalizePath, Platform, TFile, TFolder } from 'obsidian'
import type HomeTab from './main'
import iconSuggester from './suggester/iconSuggester'
import { lucideIcons, type LucideIcon } from './utils/lucideIcons'
import ImageFileSuggester from './suggester/imageSuggester'
import cssUnitValidator from './utils/cssUnitValidator'
import isLink from './utils/isLink'
import fontSuggester from './suggester/fontSuggester'
import type { RecentFileStore } from './recentFiles'
import type { BookmarkedFileStore } from './bookmarkedFiles'
import { checkFont } from './utils/fontValidator'
import { noteTagsByPath } from './store'
import { get } from 'svelte/store'

type ColorChoices = 'default' | 'accentColor' | 'custom'
type LogoChoiches = 'default' | 'imagePath' | 'imageLink' | 'lucideIcon' | 'oldLogo' | 'none'
type FontChoiches = 'interfaceFont' | 'textFont' | 'monospaceFont' | 'custom'

interface LogoStore {
    lucideIcon: LucideIcon | ''
    imagePath: string
    imageLink: string
}

export interface HomeTabSettings {
    logoType: LogoChoiches
    logo: LogoStore
    logoScale: number
    iconColor?: string
    iconColorType: ColorChoices
    wordmark: string
    customFont: FontChoiches
    font?: string
    fontSize: string
    fontColor?: string
    fontColorType: ColorChoices
    fontWeight: number
    maxResults: number
    maxRecentFiles: number
    storeRecentFile: boolean
    showPath: boolean
    selectionHighlight: ColorChoices
    showShortcuts: boolean
    markdownOnly: boolean
    unresolvedLinks: boolean
    recentFilesStore: RecentFileStore[]
    bookmarkedFileStore: BookmarkedFileStore[]
    searchDelay: number
    replaceNewTabs: boolean
    newTabOnStart: boolean
    closePreviousSessionTabs: boolean
    omnisearch: boolean
    showOmnisearchExcerpt: boolean
    notifiedOmnisearchMissing: boolean
    taskSourceFolder: string
    dayStartHour: number
    showCompletedTasks: boolean
    upcomingDays: number
    // Whitelist of tags (without '#') that appear in the dashboard's tag-filter menu.
    // Empty array = show every tag found in indexed notes.
    allowedFilterTags: string[]
    // Currently-selected filter tags. OR semantics: a task passes if its source note
    // has at least one of these tags. Persisted across sessions.
    activeFilterTags: string[]
    // When true, show the nearest markdown heading next to each task and list
    // distinct headings under each project row.
    showHeadings: boolean
    // IDs of tabs that are visible in the task dashboard.
    activeTabs: string[]
    // Vault-relative path to the inbox folder shown in the Inbox tab.
    inboxFolder: string
}

export const DEFAULT_SETTINGS: HomeTabSettings = {
    logoType: 'default',
    logo: {
        lucideIcon: '', 
        imagePath: '', 
        imageLink: '',},
    logoScale: 1.2,
    iconColorType: 'default',
    wordmark: 'Today',
    customFont: 'interfaceFont',
    fontSize: '4em',
    fontColorType: 'default', 
    fontWeight: 600,
    maxResults: 5,
    maxRecentFiles: 5,
    storeRecentFile: true,
    showPath: true,
    selectionHighlight: 'default',
    showShortcuts: true,
    markdownOnly: false,
    unresolvedLinks: false,
    recentFilesStore: [],
    bookmarkedFileStore: [],
    searchDelay: 0,
    replaceNewTabs: true,
    newTabOnStart: true,
    closePreviousSessionTabs: false,
    omnisearch: true,
    showOmnisearchExcerpt: true,
    notifiedOmnisearchMissing: false,
    taskSourceFolder: '',
    dayStartHour: 4,
    showCompletedTasks: false,
    upcomingDays: 7,
    allowedFilterTags: [],
    activeFilterTags: [],
    showHeadings: true,
    activeTabs: ['today', 'upcoming', 'projects', 'recurring', 'inbox', 'bookmarks', 'recent'],
    inboxFolder: '01 Inbox',
}


export class HomeTabSettingTab extends PluginSettingTab{
    plugin: HomeTab
    
    constructor(app: App, plugin: HomeTab){
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void{
        const {containerEl} = this
        containerEl.empty()

        new Setting(containerEl).setName('Task management').setHeading()

        const folders = this.app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .map(f => f.path)
            .sort((a, b) => a.localeCompare(b))

        new Setting(containerEl)
            .setName('Task source folder')
            .setDesc('Mission control reads tasks from Markdown files in this folder (recursively). No tasks are pulled until a folder is chosen.')
            .addDropdown(dropdown => {
                dropdown.addOption('', '(None — pick a folder)')
                for (const path of folders) if (path !== '/') dropdown.addOption(path, path)
                dropdown.setValue(this.plugin.settings.taskSourceFolder)
                dropdown.onChange(value => {
                    this.plugin.settings.taskSourceFolder = value
                    this.plugin.saveSettings()
                    void this.plugin.taskIndex?.rebuild()
                })
            })

        new Setting(containerEl)
            .setName('Day starts at')
            .setDesc('Hour (0–23) at which a new day begins. Tasks stay on "today" until this hour, so late-night work still shows the previous day.')
            .addSlider(slider => slider
                .setLimits(0, 12, 1)
                .setValue(this.plugin.settings.dayStartHour)
                .setDynamicTooltip()
                .onChange(value => {
                    this.plugin.settings.dayStartHour = value
                    this.plugin.saveSettings()
                    this.plugin.refreshOpenViews()
                }))

        new Setting(containerEl)
            .setName('Upcoming window (days)')
            .setDesc('How many days ahead the "next days" group covers in the upcoming pane.')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.settings.upcomingDays)
                .setDynamicTooltip()
                .onChange(value => {
                    this.plugin.settings.upcomingDays = value
                    this.plugin.saveSettings()
                    this.plugin.refreshOpenViews()
                }))

        new Setting(containerEl)
            .setName('Show completed tasks')
            .setDesc('Include completed tasks in the dashboard.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCompletedTasks)
                .onChange(value => {
                    this.plugin.settings.showCompletedTasks = value
                    this.plugin.saveSettings()
                    this.plugin.refreshOpenViews()
                }))

        new Setting(containerEl)
            .setName('Show headings')
            .setDesc('Display the nearest Markdown heading next to each task and list distinct headings under each project.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHeadings)
                .onChange(value => {
                    this.plugin.settings.showHeadings = value
                    this.plugin.saveSettings()
                    this.plugin.refreshOpenViews()
                }))

        this.renderTagFilterWhitelist(containerEl)

        new Setting(containerEl).setName('Dashboard tabs').setHeading()

        const ALL_TABS: { id: string; label: string; requiresBookmarks?: true }[] = [
            { id: 'today',     label: 'Today' },
            { id: 'upcoming',  label: 'Upcoming' },
            { id: 'projects',  label: 'Projects' },
            { id: 'recurring', label: 'Recurring' },
            { id: 'inbox',     label: 'Inbox' },
            { id: 'bookmarks', label: 'Bookmarks', requiresBookmarks: true },
            { id: 'recent',    label: 'Recent Files' },
        ]

        for (const tabDef of ALL_TABS) {
            if (tabDef.requiresBookmarks && !this.app.internalPlugins.getPluginById('bookmarks')) continue
            new Setting(containerEl)
                .setName(tabDef.label)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.activeTabs.includes(tabDef.id))
                    .onChange(value => {
                        const current = new Set(this.plugin.settings.activeTabs)
                        if (value) current.add(tabDef.id); else current.delete(tabDef.id)
                        this.plugin.settings.activeTabs = [...current]
                        this.plugin.saveSettings()
                        this.plugin.refreshOpenViews()
                    })
                )
        }


        new Setting(containerEl)
        .setName('Replace new tabs with mission control')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.replaceNewTabs)
            .onChange(value => {this.plugin.settings.replaceNewTabs = value; this.plugin.saveSettings()}))

        new Setting(containerEl)
        .setName('Open mission control on startup')
        .setDesc('Focuses an existing mission control tab instead of opening another one.')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.newTabOnStart)
            .onChange(value => {this.plugin.settings.newTabOnStart = value; this.plugin.saveSettings(); this.display()}))

        if(this.plugin.settings.newTabOnStart){
            new Setting(containerEl)
                .setName('Close previous session tabs on start')
                .setDesc('Closes the previous session tabs and leaves one mission control tab.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.closePreviousSessionTabs)
                    .onChange(value => {this.plugin.settings.closePreviousSessionTabs = value; this.plugin.saveSettings()}))
        }

		new Setting(containerEl).setName('Search').setHeading()
        if(this.plugin.app.plugins.getPlugin('omnisearch')){
            new Setting(containerEl)
                .setName('Use omnisearch')
                .setDesc('Set omnisearch as the default search engine.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.omnisearch)
                    .onChange(value => {this.plugin.settings.omnisearch = value; this.plugin.saveSettings(); this.display(); this.plugin.refreshOpenViews()}))
        }
        if(!this.plugin.settings.omnisearch){
            new Setting(containerEl)
                .setName('Search only Markdown files')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.markdownOnly)
                    .onChange(value => {this.plugin.settings.markdownOnly = value; this.plugin.saveSettings(); this.plugin.refreshOpenViews()}))
    
            new Setting(containerEl)
                .setName('Show uncreated files')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.unresolvedLinks)
                    .onChange(value => {this.plugin.settings.unresolvedLinks = value; this.plugin.saveSettings(); this.plugin.refreshOpenViews()}))
            
            new Setting(containerEl)
                .setName('Show file path')
                .setDesc('Displays file path at the right of the filename.')
                .addToggle((toggle) => toggle
                    .setValue(this.plugin.settings.showPath)
                    .onChange((value) => {this.plugin.settings.showPath = value; this.plugin.saveSettings()}))
        }

        new Setting(containerEl)
            .setName('Show shortcuts')
            .setDesc('Displays shortcuts under the search results.')
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.showShortcuts)
                .onChange((value) => {
                    this.plugin.settings.showShortcuts = value
                    this.plugin.refreshOpenViews()
                    this.plugin.saveSettings()
                }
            ))

        new Setting(containerEl)
            .setName('Search results')
            .setDesc('Set how many results display.')
            .addSlider((slider) => slider
                .setLimits(1, 25, 1)
                .setValue(this.plugin.settings.maxResults)
                .setDynamicTooltip()
                .onChange((value) => {this.plugin.settings.maxResults = value; this.plugin.saveSettings()}))
            .then((settingEl) => this.addResetButton(settingEl, 'maxResults'))

        new Setting(containerEl)
            .setName('Search delay')
            .setDesc('The value is in milliseconds.')
            .addSlider((slider) => slider
                .setLimits(0, 500, 10)
                .setValue(this.plugin.settings.searchDelay)
                .setDynamicTooltip()
                .onChange((value) => {this.plugin.settings.searchDelay = value; this.plugin.saveSettings(); this.plugin.refreshOpenViews()}))
            .then((settingEl) => this.addResetButton(settingEl, 'searchDelay'))

        if(this.plugin.app.plugins.getPlugin('omnisearch')){
            new Setting(containerEl)
                .setName('Show excerpt (omnisearch)')
                .setDesc('Shows the contextual part of the note that matches the search.')
                .addToggle((toggle) => toggle
                    .setValue(this.plugin.settings.showOmnisearchExcerpt)
                    .onChange((value) => {
                        this.plugin.settings.showOmnisearchExcerpt = value
                        this.plugin.saveSettings()
                    }
                ))
        }

        new Setting(containerEl).setName('File display').setHeading()

        new Setting(containerEl)
            .setName('Inbox folder')
            .setDesc('Folder whose files are shown in the inbox tab, sorted by most-recently modified.')
            .addDropdown(dropdown => {
                dropdown.addOption('', '(None — pick a folder)')
                for (const path of folders) if (path !== '/') dropdown.addOption(path, path)
                dropdown.setValue(this.plugin.settings.inboxFolder)
                dropdown.onChange(value => {
                    this.plugin.settings.inboxFolder = value
                    this.plugin.saveSettings()
                    this.plugin.refreshOpenViews()
                })
            })

        new Setting(containerEl)
            .setName('Store last recent files')
            .setDesc('Remembers the recent files of the previous session.')
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.storeRecentFile)
                .onChange((value) => {this.plugin.settings.storeRecentFile = value; this.plugin.saveSettings()}))

        new Setting(containerEl)
            .setName('Recent files')
            .setDesc('Set how many recent files display.')
            .addSlider((slider) => slider
                .setValue(this.plugin.settings.maxRecentFiles)
                .setLimits(1, 25, 1)
                .setDynamicTooltip()
                .onChange((value) => {this.plugin.recentFileManager.onNewMaxListLength(value); this.plugin.settings.maxRecentFiles = value; this.plugin.saveSettings()}))
            .then((settingEl) => this.addResetButton(settingEl, 'maxRecentFiles'))

        new Setting(containerEl).setName('Appearance').setHeading()

        const logoTypeSetting = new Setting(containerEl)
            .setName('Logo')
            .setDesc('Remove or set a custom logo. Accepts local files, links to images or lucide icon ids.')

        logoTypeSetting.descEl.parentElement?.addClass('ultra-compressed')

        let invalidInputIcon: HTMLElement
        logoTypeSetting
            .addExtraButton((button) => {button
                .setIcon('alert-circle')
                .setTooltip('The path/link/icon is not valid.')
                invalidInputIcon = button.extraSettingsEl
                invalidInputIcon.toggleVisibility(false)
                invalidInputIcon.addClass('mod-warning')})

        const logoKey = this.plugin.settings.logoType
        if(logoKey === 'imagePath' || logoKey === 'imageLink' || logoKey === 'lucideIcon'){
            logoTypeSetting
                .addSearch((text) => {
                    if(this.plugin.settings.logoType === 'imagePath'){
                        new ImageFileSuggester(this.app, text.inputEl, {
                            isScrollable: true,
                            additionalClasses: 'mc-settings-suggester'
                        })
                    }
                    else if(this.plugin.settings.logoType === 'lucideIcon'){
                        new iconSuggester(this.app, text.inputEl, {
                            isScrollable: true,
                            additionalClasses: 'mc-settings-suggester'
                        },
                            true)
                    }
                    text
                        .setPlaceholder('Type anything ... ')
                        .setValue(this.plugin.settings.logo[logoKey])
                        .onChange(async (value) => {
                            if(value === '' || value == '/'){
                                invalidInputIcon.toggleVisibility(false)
                                return
                            }
                            if(this.plugin.settings.logoType === 'imagePath'){
                                const normalizedPath = normalizePath(value)
                                if (this.app.vault.getAbstractFileByPath(normalizedPath) instanceof TFile){
                                    invalidInputIcon.toggleVisibility(false)
                                    this.plugin.settings.logo['imagePath'] = normalizedPath
                                    this.plugin.saveSettings()
                                }
                                else{
                                    invalidInputIcon.toggleVisibility(true)
                                }
                            }
                            else if(this.plugin.settings.logoType === 'imageLink'){
                                if(isLink(value)){
                                    invalidInputIcon.toggleVisibility(false)
                                    this.plugin.settings.logo['imageLink'] = value
                                    this.plugin.saveSettings()
                                }
                                else{
                                    invalidInputIcon.toggleVisibility(true)
                                }
                            }
                            else if(this.plugin.settings.logoType === 'lucideIcon'){
                                if(lucideIcons.includes(value as LucideIcon)){
                                    this.plugin.settings.logo['lucideIcon'] = value as LucideIcon
                                    this.plugin.saveSettings()
                                    invalidInputIcon.toggleVisibility(false)
                                }
                                else{
                                    invalidInputIcon.toggleVisibility(true)
                                }
                            }
                        })
                        .inputEl.parentElement?.addClass('wide-input-container')
                })
        }

        logoTypeSetting
            .addDropdown((dropdown) => dropdown
                .addOption('default', 'Obsidian logo')
                .addOption('oldLogo', 'Obsidian old logo')
                .addOption('imagePath', 'Local image')
                .addOption('imageLink', 'Link')
                .addOption('lucideIcon', 'Lucide icon')
                .addOption('none', 'Empty')
                .setValue(this.plugin.settings.logoType)
                .onChange((value) => {this.plugin.settings.logoType = value as LogoChoiches; this.plugin.saveSettings(); this.display()}))
            .then((settingEl) => this.addResetButton(settingEl, 'logoType'))
        
        if(this.plugin.settings.logoType === 'lucideIcon'){
            const iconColorSetting = new Setting(containerEl)
                .setName('Logo icon color')
                .setDesc('Set the icon color')
                
            if (this.plugin.settings.iconColorType === 'custom'){
                iconColorSetting.addColorPicker((colorPicker) => colorPicker
                    .setValue(this.plugin.settings.iconColor ? this.plugin.settings.iconColor : '#000000')
                    .onChange((value) => {this.plugin.settings.iconColor = value; this.plugin.saveSettings()}))
            }
                
            iconColorSetting
                .addDropdown((dropdown) => dropdown
                    .addOption('default', 'Theme default')
                    .addOption('accentColor', 'Accent color')
                    .addOption('custom', 'Custom')
                    .setValue(this.plugin.settings.iconColorType)
                    .onChange((value) => {this.plugin.settings.iconColorType = value as ColorChoices; this.plugin.saveSettings(); this.display()}))
            .then((settingEl) => this.addResetButton(settingEl, 'iconColorType'))
        }
        
        new Setting(containerEl)
            .setName('Logo scale')
            .setDesc('Set the logo dimensions relative to the title font size.')
            .addSlider((slider) => slider
                .setDynamicTooltip()
                .setLimits(0.3,3, 0.1)
                .setValue(this.plugin.settings.logoScale)
                .onChange((value) => {
                    this.plugin.settings.logoScale = value
                    this.plugin.saveSettings()
            }))
            .then((settingEl) => this.addResetButton(settingEl, 'logoScale'))
        
        new Setting(containerEl)
            .setName('Title')
            .addText((text) => text
                .setValue(this.plugin.settings.wordmark)
                .onChange((value) => {
                    this.plugin.settings.wordmark = value
					this.plugin.saveSettings()
                }))
            .then((settingEl) => this.addResetButton(settingEl, 'wordmark'))


        const titleFontSettings = new Setting(containerEl)
            .setName('Title font')
            .setDesc('Interface font, text font, and monospace font options match the fonts set in the appearance setting tab.')

        titleFontSettings.descEl.parentElement?.addClass('compressed')

        if(this.plugin.settings.customFont === 'custom'){
            let invalidFontIcon: HTMLElement
            titleFontSettings
                .addExtraButton((button) => {button
                    .setIcon('alert-circle')
                    .setTooltip('The font is not valid.')
                    invalidFontIcon = button.extraSettingsEl
                    invalidFontIcon.toggleVisibility(false)
                    invalidFontIcon.addClass('mod-warning')})

            titleFontSettings.addSearch((text) => {
                text.setValue(this.plugin.settings.font ? this.plugin.settings.font.replace(/"/g, ''): '')
                text.setPlaceholder('Type anything ... ')
                const suggester: fontSuggester | undefined = Platform.isMobile || Platform.isMacOS ? undefined : new fontSuggester(this.app, text.inputEl, {
                    isScrollable: true,
                    additionalClasses: 'mc-settings-suggester mc-font-suggester'
                })

                text.onChange(async (value) => {
                    value = value.indexOf(' ') >= 0 ? `"${value}"` : value //Restore "" if font name contains whitespaces
                    if((suggester && (await suggester.getInstalledFonts()).includes(value)) || checkFont(value) ){
                        this.plugin.settings.font = value
                        this.plugin.saveSettings()
                        invalidFontIcon.toggleVisibility(false)
                    }
                    else{
                        invalidFontIcon.toggleVisibility(true)
                    }
                })
                .inputEl.parentElement?.addClass('wide-input-container')
            })
        }

        titleFontSettings
            .addDropdown(dropdown => dropdown
                .addOption('interfaceFont', 'Interface font')
                .addOption('textFont', 'Text font')
                .addOption('monospaceFont', 'Monospace font')
                .addOption('custom', 'Custom font')
                .setValue(this.plugin.settings.customFont)
                .onChange((value) => {
                    this.plugin.settings.customFont = value as FontChoiches
                    this.plugin.saveSettings()
                    this.display()
                })
            )
        this.addResetButton(titleFontSettings, 'customFont')

        let invalidFontSizeIcon: HTMLElement
        new Setting(containerEl)
            .setName('Title font size')
            .setDesc('Accepts any CSS font-size value.')
            .addExtraButton((button) => {button
                .setIcon('alert-circle')
                .setTooltip('The CSS unit is not valid.')
                invalidFontSizeIcon = button.extraSettingsEl
                invalidFontSizeIcon.addClass('mod-warning')
                invalidFontSizeIcon.toggleVisibility(false)
            })
            .addText((text) => text
                .setValue(this.plugin.settings.fontSize)
                .onChange((value) => {
                    if(cssUnitValidator(value)){
                        this.plugin.settings.fontSize = value
                        this.plugin.saveSettings()
                        invalidFontSizeIcon.toggleVisibility(false)
                    }
                    else{
                        invalidFontSizeIcon.toggleVisibility(true)
                    }
                }))
            .then((settingEl) => this.addResetButton(settingEl, 'fontSize'))

        new Setting(containerEl)
            .setName('Title font weight')
            .addSlider((slider) => slider
                .setLimits(100, 900, 100)
                .setDynamicTooltip()
                .setValue(this.plugin.settings.fontWeight)
                .onChange((value) => {
                    this.plugin.settings.fontWeight = value
                    this.plugin.saveSettings()
                }))
            .then((settingEl) => this.addResetButton(settingEl, 'fontWeight'))

        const titleColorSetting = new Setting(containerEl)
            .setName('Title color')

        if (this.plugin.settings.fontColorType === 'custom'){
            titleColorSetting.addColorPicker((colorPicker) => colorPicker
                .setValue(this.plugin.settings.fontColor?this.plugin.settings.fontColor : '#000000')
                .onChange((value) => {this.plugin.settings.fontColor = value; this.plugin.saveSettings()}))
        }

        titleColorSetting
            .addDropdown((dropdown) => dropdown
                .addOption('default', 'Theme default')
                .addOption('accentColor', 'Accent color')
                .addOption('custom', 'Custom')
                .setValue(this.plugin.settings.fontColorType)
                .onChange((value) => {this.plugin.settings.fontColorType = value as ColorChoices; this.plugin.saveSettings(); this.display()}))
            .then((settingEl) => this.addResetButton(settingEl, 'fontColorType'))
    
        new Setting(containerEl)
        .setName('Selection highlight')
        .setDesc('Set the color of the selected item.')
        .addDropdown((dropdown) => dropdown
            .addOption('default', 'Theme default')
            .addOption('accentColor', 'Accent color')
            .setValue(this.plugin.settings.selectionHighlight)
            .onChange((value) => {this.plugin.settings.selectionHighlight = value as ColorChoices; this.plugin.saveSettings(); this.plugin.refreshOpenViews()}))
        .then((settingEl) => this.addResetButton(settingEl, 'selectionHighlight'))
    }

    /**
     * Renders the tag-filter whitelist control. Pulls available tags from the
     * indexed source folder (via `noteTagsByPath`) and lets the user toggle which
     * ones appear in the dashboard's filter menu. Empty list = show every tag.
     */
    private renderTagFilterWhitelist(containerEl: HTMLElement): void {
        const availableTags = new Set<string>()
        for (const tags of get(noteTagsByPath).values()) for (const t of tags) availableTags.add(t)
        const allTags = [...availableTags].sort((a, b) => a.localeCompare(b))

        const setting = new Setting(containerEl)
            .setName('Tag filter menu')
            .setDesc('Pick which tags appear in the dashboard\'s filter menu. Leave empty to show every tag found in your task notes.')

        const wrapper = setting.controlEl.createDiv({ cls: 'mc-tag-whitelist' })
        if (allTags.length === 0) {
            wrapper.createEl('em', { text: 'No tags found in the configured source folder yet.' })
            return
        }
        for (const tag of allTags) {
            const row = wrapper.createDiv({ cls: 'mc-tag-whitelist-row' })
            const cb = row.createEl('input', { type: 'checkbox' })
            cb.checked = this.plugin.settings.allowedFilterTags.includes(tag)
            row.createEl('label', { text: '#' + tag })
            cb.addEventListener('change', () => {
                const list = new Set(this.plugin.settings.allowedFilterTags)
                if (cb.checked) list.add(tag); else list.delete(tag)
                this.plugin.settings.allowedFilterTags = [...list].sort()
                // Drop any active filter tags that just left the whitelist.
                if (this.plugin.settings.allowedFilterTags.length > 0) {
                    this.plugin.settings.activeFilterTags = this.plugin.settings.activeFilterTags
                        .filter(t => this.plugin.settings.allowedFilterTags.includes(t))
                }
                this.plugin.saveSettings()
            })
        }
    }

    addResetButton<K extends keyof HomeTabSettings>(settingElement: Setting, settingKey: K, refreshView = true): void {
        settingElement
            .addExtraButton((button) => button
                    .setIcon('reset')
                    .setTooltip('Reset to default')
                    .onClick(() => {
                        this.plugin.settings[settingKey] = DEFAULT_SETTINGS[settingKey]
                        this.plugin.saveSettings()
                        if(refreshView){this.display()}
                    }))
    }
}
