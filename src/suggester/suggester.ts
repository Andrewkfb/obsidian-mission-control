// Inspired from @liamcain periodic notes suggest: https://github.com/liamcain/obsidian-periodic-notes/blob/main/src/ui/suggest.ts

import { debounce, Platform, Scope, type App } from 'obsidian'
import suggesterView from '../ui/suggesterView.svelte'
import { createPopper, type Instance as PopperInstance } from '@popperjs/core';
import { mount, unmount, type Component } from 'svelte'
import { get, writable, type Writable } from 'svelte/store';

export interface Shortcut {
    hotkey: string
    action: string
}

export interface suggesterViewOptions{
    isScrollable?: boolean
    containerClass?: string
    suggestionClass?: string
    additionalClasses?: string
    shortcuts?: Shortcut[]
}

interface ISuggester<T>{
    getSuggestions(input: string): T[] | Promise<T[]>
    useSelectedItem(item: T, middleClick?: boolean): void
    getDisplayElementProps(suggestion: T): object
    scrollSelectedItemIntoView(): void
    onNoSuggestion(): void
}

export class Suggester<T>{
    private ISuggester: ISuggester<T>
    private suggestions: T[] = []
    private selectedItemIndex = 0
    suggestionsContainer: Writable<HTMLElement>
    suggestionsStore: Writable<T[]>
    selectedItemIndexStore: Writable<number>

    constructor(ISuggester: ISuggester<T>, scope: Scope){
        this.ISuggester = ISuggester

        // Svelte store variables
        this.suggestionsStore = writable()
        this.selectedItemIndexStore = writable()
        this.suggestionsContainer = writable()

        this.selectedItemIndexStore.subscribe((value) => this.selectedItemIndex = value)
        this.suggestionsStore.subscribe((value) => this.suggestions = value)

        this.setSuggestions([])
        this.setSelectedItemIndex(0)

        scope.register([], 'ArrowUp', (e) => {
            e.preventDefault()
            this.setSelectedItemIndex(this.selectedItemIndex - 1)
            this.ISuggester.scrollSelectedItemIntoView()
        })
        scope.register([], 'ArrowDown', (e) => {
            e.preventDefault()
            this.setSelectedItemIndex(this.selectedItemIndex + 1)
            this.ISuggester.scrollSelectedItemIntoView()
        })
        scope.register([], 'Enter', (e) => {
            e.preventDefault()
            this.ISuggester.useSelectedItem(this.getSelectedItem())
        })
    }

    setSuggestions(suggestions: T[]){
        this.selectedItemIndexStore.set(0) // Reset selected item to the first result
        this.suggestionsStore.set(suggestions) // Update suggestions list
    }
    getSuggestions(): T[]{
        return this.suggestions
    }
    getSelectedItem(): T{
        return this.suggestions[this.selectedItemIndex]
    }
    getSelectedItemIndex(): number{
        return this.selectedItemIndex
    }
    getSuggestionByIndex(index: number): T{
        return this.suggestions[index]
    }
    setSelectedItemIndex(newIndex: number): void{
        if (newIndex >= this.suggestions.length){
            this.selectedItemIndexStore.set(0)
        }
        else if (newIndex < 0){
            this.selectedItemIndexStore.set(this.suggestions.length - 1)
        }
        else{
            this.selectedItemIndexStore.set(newIndex)
        }
    }
}

export abstract class TextInputSuggester<T> implements ISuggester<T>{
    protected app: App
    protected inputEl: HTMLInputElement
    
    protected suggestionParentContainer: HTMLElement
    protected suggestionContainer!: HTMLElement
    protected suggesterView?: Record<string, unknown>

    protected scope: Scope
    protected viewOptions: suggesterViewOptions
    
    protected suggester: Suggester<T>

    protected additionalCleaning(): void{}
    protected onOpen(): void{}
    protected onClose(): void{}

    protected closingAnimationTimeout: number | undefined
    protected closingAnimationRunning: boolean

    private inputListener: EventListener

    constructor(app: App, inputEl: HTMLInputElement, suggestionParentContainer: HTMLElement, viewOptions?: suggesterViewOptions, searchDelay?: number){
        this.app = app
        this.inputEl = inputEl
        this.scope = new Scope(this.app.scope)
        
        this.suggester = new Suggester(this, this.scope)
        
        const onInput = (): void => { void this.onInput() }
        this.inputListener = searchDelay ? debounce(onInput, searchDelay, false) : onInput
        this.inputEl.addEventListener('input', this.inputListener)
        this.inputEl.addEventListener('focus', this.inputListener)
        this.inputEl.addEventListener('blur', this.close.bind(this))
        
        this.scope.register([], 'escape', this.close.bind(this))
        
        this.viewOptions = viewOptions ?? {}
        this.suggestionParentContainer = suggestionParentContainer
        this.closingAnimationRunning = false
    }

    async onInput(): Promise<void>{
        const input = this.inputEl.value
        const suggestions = await this.getSuggestions(input)
        if(suggestions.length > 0){
            this.suggester.setSuggestions(suggestions)
            this.open()
        }
        else if(suggestions.length === 0){
            this.onNoSuggestion()
        }
    }

    onNoSuggestion(): void{
        this.close()
    }

    getContainerEl(): HTMLElement{
        return this.suggestionParentContainer
    }

    open(): void{
        if(this.closingAnimationRunning) this.abortClosingAnimation()
        if(this.suggesterView) return
        
        this.suggestionContainer = this.getContainerEl()

        this.app.keymap.pushScope(this.scope)

        this.suggesterView = mount(suggesterView, {
            target: this.suggestionContainer,
            props:{
                textInputSuggester: this,
                options: this.viewOptions,
            },
            intro: true,
        })

        this.onOpen()
    }

    close(): void{
        this.app.keymap.popScope(this.scope)

        // Reset suggestions
        this.suggester.setSuggestions([])

        // Allow svelte to run the animation, then remove the component(s)
        if(this.suggesterView && !this.closingAnimationRunning){
            const view = this.suggesterView
            this.closingAnimationRunning = true
            this.closingAnimationTimeout = window.setTimeout(() => {
                if (this.suggesterView === view) this.suggesterView = undefined
                void unmount(view)
                this.closingAnimationTimeout = undefined
                this.closingAnimationRunning = false
            }, 200)
        }

        this.additionalCleaning()
        this.onClose()
    }
    abortClosingAnimation(): void{
        if (this.closingAnimationTimeout) window.clearTimeout(this.closingAnimationTimeout)
        this.closingAnimationTimeout = undefined
        const view = this.suggesterView
        this.suggesterView = undefined
        if (view) void unmount(view)
        this.closingAnimationRunning = false
    }
    
    destroy(): void{
        this.close()
        this.inputEl.removeEventListener('input', this.inputListener)
        this.inputEl.removeEventListener('focus', this.inputListener)
    }
    
    scrollSelectedItemIntoView(): void{
        get(this.suggester.suggestionsContainer).children[this.suggester.getSelectedItemIndex()]?.scrollIntoView({behavior: 'auto', block: 'nearest', inline: 'nearest'})
    }
    
    getSuggester(): Suggester<T>{
        return this.suggester
    }

    setInput(input: string): void{
        this.inputEl.value = input
        this.inputEl.dispatchEvent(new Event("input")) // Trigger input
    }

    abstract getSuggestions(input: string): T[] | Promise<T[]>
    abstract useSelectedItem(item: T, middleClick?: boolean): void
    abstract getDisplayElementProps(suggestion: T): object
    abstract getDisplayElementComponentType(): Component
}

export abstract class PopoverTextInputSuggester<T> extends TextInputSuggester<T>{
    private popperInstance: PopperInstance | undefined
    private popperWrapper: HTMLElement | undefined
    
    constructor(app: App, inputEl: HTMLInputElement, viewOptions?: suggesterViewOptions){
        super(app, inputEl, app.dom.appContainerEl, viewOptions)
    }

    getContainerEl(): HTMLElement {
        if(this.popperWrapper && document.contains(this.popperWrapper)) return this.popperWrapper
        this.popperWrapper = this.suggestionParentContainer.createDiv('popper-wrapper')
        const isPhone = Platform.isPhone
        this.popperWrapper.toggleClass('is-phone', isPhone)
        const popperReference = isPhone ? document.body : this.inputEl
        
        this.popperInstance = createPopper(popperReference, this.popperWrapper, {
            placement: 'bottom-start',
            modifiers: [{
                name: 'offset',
                options: {
                    offset: [0, 5]
                }
            }]
        })

        return this.popperWrapper
    }

    additionalCleaning(): void {
        if(this.popperInstance){
            this.popperInstance.destroy()
        }
        if(this.popperWrapper && document.body.contains(this.popperWrapper)){
            this.popperWrapper.detach()
        }
    }

    abstract getSuggestions(input: string): T[] | Promise<T[]>
    abstract useSelectedItem(item: T): void
    abstract getDisplayElementProps(suggestion: T): object
    abstract getDisplayElementComponentType(): Component
}
