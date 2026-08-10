<script lang="ts">
    import { quintOut } from 'svelte/easing'
    import { slide } from 'svelte/transition'
	import type { Suggester, TextInputSuggester, suggesterViewOptions } from '../suggester/suggester';

    export let options: suggesterViewOptions
    export let textInputSuggester: TextInputSuggester<any>

    let suggester: Suggester<any> = textInputSuggester.getSuggester()

    let suggestions: any[]
    suggester.suggestionsStore.subscribe((value) => suggestions = value)
    
    let selectedItemIndex: number
    suggester.selectedItemIndexStore.subscribe((value) => selectedItemIndex = value)
    
    const suggestionWrapper = suggester.suggestionsContainer

</script>

{#if suggestions && suggestions.length > 0}
    <div class="{options.containerClass ?? 'suggestion-container popover suggestion-popover'}"
        role="presentation"
        on:mousedown="{(e) => e.preventDefault()}"
        transition:slide={{duration:200, easing: quintOut}}>
        <div class="{options.suggestionClass ?? 'suggestion'} {options.additionalClasses ?? ''}" class:scrollable="{options.isScrollable}"
            bind:this={$suggestionWrapper}>
            {#each suggestions as suggestion, index (suggestion)}
                <svelte:component this={textInputSuggester.getDisplayElementComponentType()}
                                {index} {suggestion} {textInputSuggester} {selectedItemIndex}
                                {... textInputSuggester.getDisplayElementProps(suggestion)}/>
            {/each}
        </div>
        {#if options.shortcuts}
            <div class="suggester-additional-info home-tab-hotkey-suggestions">
                {#each options.shortcuts as shortcut}
                    <div class="prompt-instruction">
                        <span class="prompt-instruction-command">{shortcut.hotkey}</span>
                        <span>{shortcut.action}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/if}
    

<style>
    .scrollable{
        overflow-y: auto;
    }
</style>
