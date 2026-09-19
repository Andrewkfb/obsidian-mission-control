<script lang="ts">
	import type { ResultNoteApi } from "src/suggester/omnisearchSuggester";
	import type { TextInputSuggester } from "src/suggester/suggester";
	import { getExtensionFromFilename } from "src/utils/getFileTypeUtils";
	import Suggestion from "./suggestion.svelte";
    import ObsidianIcon from "./ObsidianIcon.svelte";

    interface Props {
        index: number
        textInputSuggester: TextInputSuggester<ResultNoteApi>
        selectedItemIndex: number
        suggestion: ResultNoteApi
        basename: string
        excerpt: string
    }

    let { index, textInputSuggester, selectedItemIndex, suggestion, basename, excerpt }: Props = $props()

    const fileExtension = $derived(getExtensionFromFilename(suggestion.path))
    const folderPath = $derived(suggestion.path.replace(`${suggestion.basename}.${fileExtension}`, '').slice(0, -1))
</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}
    suggestionItemClass={'suggestion-item omnisearch-result'}
    suggestionContentClass={''}
    suggestionTitleClass={'omnisearch-result__title-container'}>
    {#snippet suggestionTitle()}
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
    {/snippet}
    {#snippet suggestionExtraContent()}
        {#if folderPath.length > 0}
            <div class="omnisearch-result__folder-path">
                <ObsidianIcon icon="folder-open" size="small" />
                <span>{folderPath}</span>
            </div>
        {/if}
        <div class="omnisearch-result__body">
            {excerpt}
        </div>
    {/snippet}
</Suggestion>
