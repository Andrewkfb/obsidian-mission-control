<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Suggester, TextInputSuggester } from "src/suggester/suggester";

    interface Props {
        index: number
        textInputSuggester: TextInputSuggester<any>
        selectedItemIndex: number
        suggestionItemClass?: string
        suggestionContentClass?: string
        suggestionTitleClass?: string
        suggestionAuxClass?: string
        // Named slots are snippet props under runes.
        suggestionTitle?: Snippet
        suggestionExtraContent?: Snippet
        suggestionAux?: Snippet
    }

    let {
        index,
        textInputSuggester,
        selectedItemIndex,
        suggestionItemClass = undefined,
        suggestionContentClass = undefined,
        suggestionTitleClass = undefined,
        suggestionAuxClass = undefined,
        suggestionTitle = undefined,
        suggestionExtraContent = undefined,
        suggestionAux = undefined,
    }: Props = $props()

    const suggester: Suggester<any> = $derived(textInputSuggester.getSuggester())
</script>

<div class={suggestionItemClass ?? 'suggestion-item mod-complex'}
    class:is-selected={selectedItemIndex === index}
    role="option"
    aria-selected={selectedItemIndex === index}
    tabindex="-1"
    onmousemove={() => suggester.setSelectedItemIndex(index)}
    onclick={() => textInputSuggester.useSelectedItem(suggester.getSelectedItem())}
    onkeydown={(e) => { if (e.key === 'Enter') textInputSuggester.useSelectedItem(suggester.getSelectedItem()) }}
    onauxclick={(e) => { if (e.button === 1) textInputSuggester.useSelectedItem(suggester.getSelectedItem(), true) }}>
    <div class={suggestionContentClass ?? 'suggestion-content'}>
        <div class={suggestionTitleClass ?? 'suggestion-title'}>
            {@render suggestionTitle?.()}
        </div>
        {@render suggestionExtraContent?.()}
    </div>
    <div class={suggestionAuxClass ?? 'suggestion-aux'}>
        {@render suggestionAux?.()}
    </div>
</div>
