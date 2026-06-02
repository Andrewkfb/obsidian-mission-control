import { App, Setting, PluginSettingTab, normalizePath, Platform, TFolder } from 'obsidian'
import type HomeTab from './main'
import iconSuggester from './suggester/iconSuggester'
import { lucideIcons, type LucideIcon } from './utils/lucideIcons'
import ImageFileSuggester from './suggester/imageSuggester'
import cssUnitValidator from './utils/cssUnitValidator'
import isLink from './utils/isLink'
import fontSuggester from './suggester/fontSuggester'
import type { recentFileStore } from './recentFiles'
import type { bookmarkedFileStore } from './bookmarkedFiles'
import { checkFont } from './utils/fontValidator'
import { noteTagsByPath } from './store'
import { get } from 'svelte/store'

type ColorChoices = 'default' | 'accentColor' | 'custom'
type LogoChoiches = 'default' | 'imagePath' | 'imageLink' | 'lucideIcon' | 'oldLogo' | 'none'
type FontChoiches = 'interfaceFont' | 'textFont' | 'monospaceFont' | 'custom'

interface ObjectKeys {
    [key: string]: any
}

interface logoStore extends ObjectKeys{
    lucideIcon: LucideIcon | ''
    imagePath: string
    imageLink: string
}

export interface HomeTabSettings extends ObjectKeys{
    logoType: LogoChoiches
    logo: logoStore
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
    showbookmarkedFiles: boolean
    showRecentFiles: boolean
    maxRecentFiles: number
    storeRecentFile: boolean
    showPath: boolean
    selectionHighlight: ColorChoices
    showShortcuts: boolean
    markdownOnly: boolean
    unresolvedLinks: boolean
    recentFilesStore: recentFileStore[]
    bookmarkedFileStore: bookmarkedFileStore[]
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
    showbookmarkedFiles: true,  // evaluated safely at runtime in main.ts onLayoutReady
    showRecentFiles: false,
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
    activeTabs: ['today', 'upcoming', 'projects', 'inbox', 'bookmarks', 'recent'],
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

		containerEl.createEl('h3', {text: 'Mission Control settings'});

        containerEl.createEl('h2', {text: 'Task management'});

        const folders = this.app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .map(f => f.path)
            .sort((a, b) => a.localeCompare(b))

        new Setting(containerEl)
            .setName('Task source folder')
            .setDesc('Mission Control reads tasks from markdown files in this folder (recursively). No tasks are pulled until a folder is chosen.')
            .addDropdown(dropdown => {
                dropdown.addOption('', '(none — pick a folder)')
                folders.forEach(path => path !== '/' ? dropdown.addOption(path, path) : null)
                dropdown.setValue(this.plugin.settings.taskSourceFolder)
                dropdown.onChange(value => {
                    this.plugin.settings.taskSourceFolder = value
                    this.plugin.saveSettings()
                    this.plugin.taskIndex?.rebuild()
                })
            })

        new Setting(containerEl)
            .setName('Day starts at')
            .setDesc('Hour (0–23) at which a new day begins. Tasks stay on "Today" until this hour, so late-night work still shows the previous day.')
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
            .setDesc('How many days ahead the "Next days" group covers in the Upcoming pane.')
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
            .setDesc('Display the nearest markdown heading next to each task and list distinct headings under each project.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHeadings)
                .onChange(value => {
                    this.plugin.settings.showHeadings = value
                    this.plugin.saveSettings()
                    this.plugin.refreshOpenViews()
                }))

        this.renderTagFilterWhitelist(containerEl)

        containerEl.createEl('h2', {text: 'Dashboard tabs'})

        const ALL_TABS: { id: string; label: string; requiresBookmarks?: true }[] = [
            { id: 'today',     label: 'Today' },
            { id: 'upcoming',  label: 'Upcoming' },
            { id: 'projects',  label: 'Projects' },
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

        containerEl.createEl('h2', {text: 'General settings'});
        new Setting(containerEl)
        .setName('Replace new tabs with Home tab')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.replaceNewTabs)
            .onChange(value => {this.plugin.settings.replaceNewTabs = value; this.plugin.saveSettings()}))

        new Setting(containerEl)
        .setName('Open new Home tab on Obsidian start')
        .setDesc('If a Home tab is already open it\'ll focus it instead of opening a new one.')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.newTabOnStart)
            .onChange(value => {this.plugin.settings.newTabOnStart = value; this.plugin.saveSettings(); this.display()}))

        if(this.plugin.settings.newTabOnStart){
            new Setting(containerEl)
                .setName('Close previous session tabs on start')
                .setDesc('Enable this to close all the tabs and leave only one Home tab on Obsidian opening.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.closePreviousSessionTabs)
                    .onChange(value => {this.plugin.settings.closePreviousSessionTabs = value; this.plugin.saveSettings()}))
        }

		containerEl.createEl('h2', {text: 'Search settings'});
        if(this.plugin.app.plugins.getPlugin('omnisearch')){
            new Setting(containerEl)
                .setName('Use Omnisearch')
                .setDesc('Set Omnisearch as the default search engine.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.omnisearch)
                    .onChange(value => {this.plugin.settings.omnisearch = value; this.plugin.saveSettings(); this.display(); this.plugin.refreshOpenViews()}))
        }
        if(!this.plugin.settings.omnisearch){
            new Setting(containerEl)
                .setName('Search only markdown files')
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
            .setName('Show shorcuts')
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
                .setName('Show excerpt (Omnisearch)')
                .setDesc('Shows the contextual part of the note that matches the search.')
                .addToggle((toggle) => toggle
                    .setValue(this.plugin.settings.showOmnisearchExcerpt)
                    .onChange((value) => {
                        this.plugin.settings.showOmnisearchExcerpt = value
                        this.plugin.saveSettings()
                    }
                ))
        }

        containerEl.createEl('h2', {text: 'Files display'});

        new Setting(containerEl)
            .setName('Inbox folder')
            .setDesc('Folder whose files are shown in the Inbox tab, sorted by most-recently modified.')
            .addDropdown(dropdown => {
                dropdown.addOption('', '(none — pick a folder)')
                folders.forEach(path => path !== '/' ? dropdown.addOption(path, path) : null)
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
                .onChange((value) => {this.plugin.recentFileManager.onNewMaxListLenght(value); this.plugin.settings.maxRecentFiles = value; this.plugin.saveSettings()}))
            .then((settingEl) => this.addResetButton(settingEl, 'maxRecentFiles'))

        containerEl.createEl('h2', {text: 'Appearance'});

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

        if(this.plugin.settings.logoType === 'imagePath' || this.plugin.settings.logoType === 'imageLink' || this.plugin.settings.logoType === 'lucideIcon'){
            logoTypeSetting
                .addSearch((text) => {
                    if(this.plugin.settings.logoType === 'imagePath'){
                        new ImageFileSuggester(this.app, text.inputEl, {
                            isScrollable: true,
                            style: `max-height: 200px`
                        })
                    }
                    else if(this.plugin.settings.logoType === 'lucideIcon'){
                        new iconSuggester(this.app, text.inputEl, {
                            isScrollable: true,
                            style: `max-height: 200px`}, 
                            true)
                    }
                    text
                        // .setPlaceholder(this.plugin.settings.logo[this.plugin.settings.logoType] != '' ? this.plugin.settings.logo[this.plugin.settings.logoType] : 'Type anything ... ')
                        .setPlaceholder('Type anything ... ')
                        .setValue(this.plugin.settings.logo[this.plugin.settings.logoType] != '' ? this.plugin.settings.logo[this.plugin.settings.logoType] : '')
                        .onChange(async (value) => {
                            if(value === '' || value == '/'){
                                invalidInputIcon.toggleVisibility(false)
                                return
                            }
                            if(this.plugin.settings.logoType === 'imagePath'){
                                const normalizedPath = normalizePath(value)
                                if (await app.vault.adapter.exists(normalizedPath)){
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
                .onChange((value: LogoChoiches) => {this.plugin.settings.logoType = value; this.plugin.saveSettings(); this.display()}))
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
                    .onChange((value: ColorChoices) => {this.plugin.settings.iconColorType = value; this.plugin.saveSettings(); this.display()}))
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
            // .setDesc('Set a custom title')
            .addText((text) => text
                .setValue(this.plugin.settings.wordmark)
                .onChange((value) => {
                    this.plugin.settings.wordmark = value
					this.plugin.saveSettings()
                }))
            .then((settingEl) => this.addResetButton(settingEl, 'wordmark'))


        const titleFontSettings = new Setting(containerEl)
            .setName('Title font')
            .setDesc('Interface font, text font, and monospace font options match the fonts set in the Appearance setting tab.')
            // .setDesc(createFragment(f => {
            //     f.appendText('Interface font, text font, and monospace font options');
            //     f.createEl('br')
            //     f.appendText('match the fonts set in the Appearance setting tab.')
            //   }))

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
                    style: `max-height: 200px;
                    width: fit-content;
                    min-width: 200px;`}, 
                    true)

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
                .onChange((value: FontChoiches) => {
                    this.plugin.settings.customFont = value
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
            // .setDesc('Set title font weight')
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
                .onChange((value: ColorChoices) => {this.plugin.settings.fontColorType = value; this.plugin.saveSettings(); this.display()}))
            .then((settingEl) => this.addResetButton(settingEl, 'fontColorType'))
    
        new Setting(containerEl)
        .setName('Selection highlight')
        .setDesc('Set the color of the selected item.')
        .addDropdown((dropdown) => dropdown
            .addOption('default', 'Theme default')
            .addOption('accentColor', 'Accent color')
            .setValue(this.plugin.settings.selectionHighlight)
            .onChange((value: ColorChoices) => {this.plugin.settings.selectionHighlight = value; this.plugin.saveSettings(); this.plugin.refreshOpenViews()}))
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

    addResetButton(settingElement: Setting, settingKey: string, refreshView: boolean = true){
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