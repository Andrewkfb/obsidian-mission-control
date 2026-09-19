<script lang="ts">
    import type Fuse from 'fuse.js'
	import type { TFile } from 'obsidian';
	import type { TextInputSuggester } from "src/suggester/suggester";
	import Suggestion from "./suggestion.svelte";

    interface Props {
        index: number
        textInputSuggester: TextInputSuggester<TFile>
        selectedItemIndex: number
        suggestion: Fuse.FuseResult<TFile>
        displayName?: string
    }

    let { index, textInputSuggester, selectedItemIndex, suggestion, displayName = undefined }: Props = $props()
</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}>
    {#snippet suggestionTitle()}{displayName ?? suggestion.item.basename}{/snippet}
</Suggestion>
