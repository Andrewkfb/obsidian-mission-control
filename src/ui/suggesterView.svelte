<script lang="ts">
    import { untrack } from 'svelte'
    import { quintOut } from 'svelte/easing'
    import { slide } from 'svelte/transition'
	import type { TextInputSuggester, suggesterViewOptions } from '../suggester/suggester';

    interface Props {
        options: suggesterViewOptions
        textInputSuggester: TextInputSuggester<any>
    }

    let { options, textInputSuggester }: Props = $props()

    // Read once, deliberately: this view is mounted per suggester and never
    // handed a different one, and the stores below feed a `bind:this`, which
    // needs a stable reference. `untrack` states that intent rather than
    // leaving the compiler to warn about a captured prop.
    const suggester = untrack(() => textInputSuggester.getSuggester())

    // Plain store auto-subscription, which still works under runes — no need to
    // mirror the stores into local state by hand.
    const suggestions = suggester.suggestionsStore
    const selectedItemIndex = suggester.selectedItemIndexStore
    const suggestionWrapper = suggester.suggestionsContainer
</script>

{#if $suggestions && $suggestions.length > 0}
    <div class={options.containerClass ?? 'suggestion-container popover suggestion-popover'}
        role="presentation"
        onmousedown={(e) => e.preventDefault()}
        transition:slide={{duration:200, easing: quintOut}}>
        <div class="{options.suggestionClass ?? 'suggestion'} {options.additionalClasses ?? ''}" class:scrollable={options.isScrollable}
            bind:this={$suggestionWrapper}>
            {#each $suggestions as suggestion, index (suggestion)}
                {@const SuggestionItem = textInputSuggester.getDisplayElementComponentType()}
                <SuggestionItem
                    {index} {suggestion} {textInputSuggester} selectedItemIndex={$selectedItemIndex}
                    {...textInputSuggester.getDisplayElementProps(suggestion)} />
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
