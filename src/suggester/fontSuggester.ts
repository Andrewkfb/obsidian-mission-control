import { PopoverTextInputSuggester,  type suggesterViewOptions } from "./suggester"
import type Fuse from 'fuse.js'
import type { App, } from 'obsidian'
import { ArrayFuzzySearch } from "./fuzzySearch"
import FontSuggestion from "src/ui/svelteComponents/fontSuggestion.svelte";

// `font-list` references the Node `process` global at module-load time, which
// blows up on mobile (no `process`). Load it lazily so simply importing this
// file is mobile-safe — call sites already guard with Platform checks.
async function loadGetFonts(): Promise<() => Promise<string[]>> {
    const mod = await import('font-list')
    return mod.getFonts
}

export default class fontSuggester extends PopoverTextInputSuggester<Fuse.FuseResult<string>>{
    private fontList: string[] | undefined
    private fuzzySearch: ArrayFuzzySearch | undefined
    constructor(app: App, inputEl: HTMLInputElement, viewOptions?: suggesterViewOptions){
        super(app, inputEl, viewOptions)

        void this.getInstalledFonts().then(fontList => this.fuzzySearch = new ArrayFuzzySearch(fontList))
    }

    async getInstalledFonts(): Promise<string[]>{
        if(!this.fontList){
            const getFonts = await loadGetFonts()
            this.fontList = await getFonts()
        }
        return this.fontList
    }

    async getSuggestions(input: string): Promise<Fuse.FuseResult<string>[]> {
        if (!this.fuzzySearch) this.fuzzySearch = new ArrayFuzzySearch(await this.getInstalledFonts())
        return this.fuzzySearch.filteredSearch(input, 0.25, 15)
    }

    useSelectedItem(selectedItem: Fuse.FuseResult<string>): void {
        this.inputEl.value = selectedItem.item.replace(/"/g, ``)
        this.inputEl.trigger("input")
        void this.onInput().then(() => this.close())
    }

    getDisplayElementComponentType(): typeof FontSuggestion{
        return FontSuggestion
    }

    getDisplayElementProps(suggestion: Fuse.FuseResult<string>): {suggestionTitle: string}{
        return {
            suggestionTitle: suggestion.item.replace(/"/g, ``),
        }
    }

    onNoSuggestion(): void {
        const input = this.inputEl.value
        // If the input is blank display all installed fonts
        if (!input){
            const suggestions: Fuse.FuseResult<string>[] = []
            this.fontList?.forEach(font => {
                suggestions.push({
                    item: font,
                    refIndex: 0,
                    score: 0,
                })
            })
            this.suggester.setSuggestions(suggestions)
            this.open()
        }
        else{
            this.close()
        }
    }
}
