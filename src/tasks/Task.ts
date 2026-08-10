// Status reflects the character inside the checkbox: [ ] [x] [/] [-] etc.
export type TaskStatus = 'open' | 'done' | 'inProgress' | 'cancelled' | 'other'

// Tasks-plugin priority scale. 'normal' = no priority marker.
export type TaskPriority = 'highest' | 'high' | 'medium' | 'normal' | 'low' | 'lowest'

export interface Task {
    // Source location
    sourcePath: string      // vault-relative path of the file the task lives in
    sourceLine: number      // 0-based line index within that file
    rawText: string         // the full original line, verbatim (for write-back later)

    // Parsed content
    text: string            // display text with metadata fields stripped out
    status: TaskStatus
    statusChar: string      // the literal char between the brackets (' ', 'x', '/', '-', ...)
    checked: boolean        // true for done/cancelled

    // Dates (ISO yyyy-mm-dd strings, or undefined)
    due?: string            // 📅 / [due::]
    scheduled?: string      // ⏳ / [scheduled::]
    start?: string          // 🛫 / [start::]
    done?: string           // ✅ / [completion::]
    created?: string        // ➕ / [created::]

    priority: TaskPriority
    recurrence?: string     // 🔁 rule text, stored verbatim (not yet computed)
    tags: string[]          // #tags found on the line, without the leading #

    // Project = basename of the source file (one file = one project)
    project: string
    // Nearest preceding markdown heading in the source file (without the leading '#'s).
    // undefined when the task appears before any heading.
    heading?: string
}

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
    highest: 0,
    high: 1,
    medium: 2,
    normal: 3,
    low: 4,
    lowest: 5,
}

export function isOpen(task: Task): boolean {
    return task.status === 'open' || task.status === 'inProgress'
}
