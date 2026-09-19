import type { Task } from './Task'

/**
 * True when `candidate` is `selected`, or nested beneath it.
 *
 * Obsidian treats `#work/q2` as living under `#work`, so picking the parent in
 * the filter menu has to match its children — otherwise selecting a broad tag
 * silently returns nothing.
 */
export function tagMatches(candidate: string, selected: string): boolean {
    return candidate === selected || candidate.startsWith(selected + '/')
}

/**
 * Every tag a task can be filtered by: the tags written on the task line
 * itself, plus the note-level tags (frontmatter + body) of the file it lives in.
 */
export function tagsForTask(task: Task, noteTags: Set<string> | undefined): Set<string> {
    const out = new Set(task.tags)
    if (noteTags) for (const t of noteTags) out.add(t)
    return out
}

/**
 * OR semantics: a task passes when any of its tags matches any selected tag.
 * An empty selection matches everything.
 */
export function taskMatchesTags(task: Task, selected: string[], noteTags: Set<string> | undefined): boolean {
    if (selected.length === 0) return true
    for (const candidate of tagsForTask(task, noteTags)) {
        for (const sel of selected) {
            if (tagMatches(candidate, sel)) return true
        }
    }
    return false
}
