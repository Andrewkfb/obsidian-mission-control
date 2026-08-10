<script lang="ts">
	import type { ResultNoteApi } from "src/suggester/omnisearchSuggester";
	import type { TextInputSuggester } from "src/suggester/suggester";
	import { getExtensionFromFilename } from "src/utils/getFileTypeUtils";
	import Suggestion from "./suggestion.svelte";
    import ObsidianIcon from "./ObsidianIcon.svelte";

    export let index: number
    export let textInputSuggester: TextInputSuggester<ResultNoteApi>
    export let selectedItemIndex: number

    export let suggestion: ResultNoteApi

    export let basename: string
    export let excerpt: string
    
    let fileExtension = getExtensionFromFilename(suggestion.path)
    let folderPath = suggestion.path.replace(`${suggestion.basename}.${fileExtension}`, '').slice(0, -1)
</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}
    suggestionItemClass={'suggestion-item omnisearch-result'}
    suggestionContentClass={''}
    suggestionTitleClass={'omnisearch-result__title-container'}>
    <svelte:fragment slot="suggestion-title">
        <span class="omnisearch-result__title">
            <span>
                <ObsidianIcon icon="file" size="small" />
            </span>
            <span>{basename}</span>
            <span class="omnisearch-result__extension">{`.${fileExtension}`}</span>
            {#if suggestion.matches.length > 0}
                <span class="omnisearch-result__counter">{`${suggestion.matches.length} match${suggestion.matches.length > 1 ? 'es' : ''}`}</span>
            {/if}
        </span>
    </svelte:fragment>
    <svelte:fragment slot="suggestion-extra-content">
        {#if folderPath.length > 0}
            <div class="omnisearch-result__folder-path">
                <ObsidianIcon icon="folder-open" size="small" />
                <span>{folderPath}</span>
            </div>
        {/if}
        <div class="omnisearch-result__body">
            {excerpt}
        </div>
    </svelte:fragment>
</Suggestion>
