/**
 * Dashboard tabs introduced after `activeTabs` first shipped.
 *
 * `activeTabs` persists the *enabled* list, so a tab added in a later version is
 * absent from every existing install and would never appear — the users who most
 * need the Backlog tab are exactly the ones who would never see it. These are
 * merged in once on load; `mergedTabAdditions` records that it happened, so
 * turning one back off sticks instead of being undone on the next launch.
 *
 * Kept free of Obsidian imports so it stays covered by the logic tests.
 */
export const TAB_ADDITIONS = ['backlog']

export function mergeTabAdditions(
    savedActiveTabs: string[] | undefined,
    alreadyMerged: string[] | undefined,
    defaultTabs: string[],
    additions: string[] = TAB_ADDITIONS,
): { activeTabs: string[]; mergedTabAdditions: string[] } {
    // A fresh install takes the defaults, which already list every tab.
    if (!savedActiveTabs) {
        return { activeTabs: [...defaultTabs], mergedTabAdditions: [...additions] }
    }
    const merged = alreadyMerged ?? []
    const pending = additions.filter(id => !merged.includes(id) && !savedActiveTabs.includes(id))
    return {
        activeTabs: [...savedActiveTabs, ...pending],
        mergedTabAdditions: [...new Set([...merged, ...additions])],
    }
}
