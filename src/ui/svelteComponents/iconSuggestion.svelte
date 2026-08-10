<script lang="ts">
    import type Fuse from 'fuse.js'
	import type { TextInputSuggester } from "src/suggester/suggester";
	import Suggestion from "./suggestion.svelte";
	import ObsidianIcon from "./ObsidianIcon.svelte";

    export let index: number
    export let textInputSuggester: TextInputSuggester<string>
    export let selectedItemIndex: number
    export let suggestion: Fuse.FuseResult<string>

    export let displayIcon: boolean

</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}>
    <svelte:fragment slot="suggestion-title">{suggestion.item}</svelte:fragment>
    <svelte:fragment slot="suggestion-aux">
        {#if displayIcon}
            <span class="suggestion-flair">
                <ObsidianIcon icon={suggestion.item} size="small" />
            </span>
        {/if}
    </svelte:fragment>
</Suggestion>
