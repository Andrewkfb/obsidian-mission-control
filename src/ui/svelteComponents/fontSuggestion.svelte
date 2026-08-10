<script lang="ts">
	import type { TextInputSuggester } from "src/suggester/suggester";
	import Suggestion from "./suggestion.svelte";

    export let index: number
    export let textInputSuggester: TextInputSuggester<string>
    export let selectedItemIndex: number

    export let suggestionTitle: string

</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}>
    <svelte:fragment slot="suggestion-title">
        <span>
            {suggestionTitle}
        </span>
    </svelte:fragment>
</Suggestion>
