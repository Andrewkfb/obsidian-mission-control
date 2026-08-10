<script lang="ts">
	import { filterKeys, type FilterKey } from "src/homeTabSearchbar";
    import type HomeTabSearchBar from "src/homeTabSearchbar";
    
    export let HomeTabSearchBar: HomeTabSearchBar
    const searchBarEl = HomeTabSearchBar.searchBarEl
    const activeExtEl = HomeTabSearchBar.activeExtEl
    const container = HomeTabSearchBar.suggestionContainerEl
    let inputValue = ''

    function handleKeydown(e: KeyboardEvent): void{
        // If the input field is empty and a filter is active remove it
        if(e.key === 'Backspace'){
            if(inputValue != '') return
            if(HomeTabSearchBar.activeFilter){
                HomeTabSearchBar.updateActiveSuggester('default')
            }
        }

        if(e.key === 'Tab'){
            e.preventDefault()
            const key = inputValue.toLowerCase()
            // Activate search filter with tab
            if(filterKeys.find(item => item === key)){
                HomeTabSearchBar.updateActiveSuggester(key as FilterKey)
            }
        }
    }

</script>

<div class="home-tab-searchbar-container" bind:this={$container}>
    <div class="home-tab-searchbar">
        <div class='nav-file-tag home-tab-suggestion-file-tag hide' bind:this={$activeExtEl}></div>
        <input type="search" spellcheck="false" placeholder="Type to start search..." bind:value={inputValue} bind:this={$searchBarEl}
        on:keydown={(e) => handleKeydown(e)}>
    </div>
</div>

<style>
    .home-tab-searchbar-container{
        display: flex;
        align-items: center;
        flex-direction: column;
    }
    
    .home-tab-searchbar{
        display: flex;
        width: 50%;
        min-width: 250px;
        max-width: 700px;
        margin: 0 auto;

        height: calc(var(--input-height)*1.25);

        background-color: var(--background-modifier-form-field);
        border: var(--input-border-width) solid var(--background-modifier-border);
        padding: var(--size-2-3);
        border-radius: var(--input-radius);
        outline: none;
    }

    .home-tab-searchbar input{
        width: 100%;
        height: 100%;
        box-shadow: none;
        font-size: var(--font-ui-medium);
        background: none;
        border: none;
        padding-left: 12px;
    }
    .home-tab-searchbar input:hover{
        background: none;
        border: none;
    }

    .home-tab-suggestion-file-tag.hide{
        display: none;
    }
    @media (max-width: 600px) {
        .home-tab-searchbar { width: 90%; }
    }
</style>
