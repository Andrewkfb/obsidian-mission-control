<script lang="ts">
    import type Fuse from 'fuse.js'
	import type { TextInputSuggester } from "src/suggester/suggester";
	import Suggestion from "./suggestion.svelte";
	import ObsidianIcon from "./ObsidianIcon.svelte";

    interface Props {
        index: number
        textInputSuggester: TextInputSuggester<string>
        selectedItemIndex: number
        suggestion: Fuse.FuseResult<string>
        displayIcon: boolean
    }

    let { index, textInputSuggester, selectedItemIndex, suggestion, displayIcon }: Props = $props()
</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}>
    {#snippet suggestionTitle()}{suggestion.item}{/snippet}
    {#snippet suggestionAux()}
        {#if displayIcon}
            <span class="suggestion-flair">
                <ObsidianIcon icon={suggestion.item} size="small" />
            </span>
        {/if}
    {/snippet}
</Suggestion>
