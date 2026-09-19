<script lang="ts">
    import type Fuse from 'fuse.js'
    import type { SearchFile } from "src/suggester/fuzzySearch";
	import type { TextInputSuggester } from "src/suggester/suggester";
	import Suggestion from './suggestion.svelte';
    import ObsidianIcon from './ObsidianIcon.svelte';

    interface Props {
        index: number
        textInputSuggester: TextInputSuggester<SearchFile>
        selectedItemIndex: number
        suggestion: Fuse.FuseResult<SearchFile>
        nameToDisplay: string
        filePath?: string
    }

    let { index, textInputSuggester, selectedItemIndex, suggestion, nameToDisplay, filePath = undefined }: Props = $props()

    const suggestionItem = $derived(suggestion.item)
</script>

<Suggestion {index} {textInputSuggester} {selectedItemIndex}
    suggestionTitleClass={`suggestion-title home-tab-suggestion-title ${suggestionItem.isUnresolved ? 'is-unresolved' : ''}`}>
    <!-- File name (or alias) -->
    {#snippet suggestionTitle()}
        <span>{nameToDisplay}</span>
        {#if suggestionItem.fileType != 'markdown'}
            <div class="nav-file-tag home-tab-suggestion-file-tag">
                {suggestionItem.extension}
            </div>
        {/if}
    {/snippet}
    <!-- File details -->
    {#snippet suggestionExtraContent()}
        {#if suggestionItem.isCreated}
            <!-- If the suggestion name is an alias display the actual filename under it -->
            {#if suggestionItem.aliases && suggestionItem.aliases?.includes(nameToDisplay)}
                <div class="home-tab-suggestion-description">
                    <ObsidianIcon icon="forward" size="small" label="Alias of" />
                    <span>{suggestionItem.basename}</span>
                </div>
            {/if}
        {/if}
    {/snippet}
    {#snippet suggestionAux()}
        <!-- Display if a file is not created -->
        {#if !suggestionItem.isCreated}
            <div class="home-tab-suggestion-tip">
                {#if suggestionItem.isUnresolved}
                    <ObsidianIcon icon="file-plus" size="small" label="Not created yet, select to create" />
                {:else}
                    <ObsidianIcon icon="file-question" size="small" label="Does not exist yet, select to create" />
                    <div class="suggestion-hotkey">
                        <span>Enter to create</span>
                    </div>
                {/if}
            </div>
        {/if}
        <!-- Add file path -->
        {#if (suggestionItem.isCreated || suggestionItem.isUnresolved) && filePath}
            <div class="home-tab-suggestion-filepath" aria-label="File path">
                <ObsidianIcon icon="folder" size="small" />
                <span class="home-tab-file-path">{filePath}</span>
            </div>
        {/if}
    {/snippet}
</Suggestion>
