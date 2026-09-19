import type { Vault } from 'obsidian'
import type { Task } from './Task'
import { computeNextDate } from './recurrence'

// Matches the checkbox portion of a task line, capturing everything before and after.
// Group 1: prefix (indent + list marker + space)
// Group 2: status char
// Group 3: rest of line after ]
const CHECKBOX_RE = /^([\s>]*[-*+]\s+\[)(.)\](.*)$/

const DONE_DATE_RE = /\s*✅\s*\d{4}-\d{2}-\d{2}/g

/**
 * Pure function: toggle a single task line string open ↔ done.
 * Used both by the vault writer and by tests.
 *
 * Completing:
 *   - Replaces the status char with 'x'.
 *   - Appends ✅ YYYY-MM-DD (removes any existing ✅ date first).
 *
 * Un-completing:
 *   - Replaces 'x'/'X' with ' '.
 *   - Strips ✅ YYYY-MM-DD.
 */
export function applyToggleToLine(line: string, toComplete: boolean, todayISO: string): string {
    const m = line.match(CHECKBOX_RE)
    if (!m) return line

    const prefix = m[1]     // e.g. "- ["
    const rest = m[3]       // everything after "]"

    if (toComplete) {
        const cleaned = rest.replace(DONE_DATE_RE, '').trimEnd()
        return `${prefix}x]${cleaned} ✅ ${todayISO}`
    } else {
        const cleaned = rest.replace(DONE_DATE_RE, '').trimEnd()
        return `${prefix} ]${cleaned}`
    }
}

/**
 * Build a new open-task line for a recurring task's next occurrence.
 * Strips the ✅ date, resets status to [ ], and updates due/scheduled dates.
 *
 * Returns undefined if the recurrence rule can't be parsed.
 */
export function buildNextRecurrence(line: string, task: Task, todayISO: string): string | undefined {
    if (!task.recurrence) return undefined

    // The reference date: prefer due, then scheduled, then today.
    const ref = task.due ?? task.scheduled ?? todayISO
    const nextDate = computeNextDate(task.recurrence, ref)
    if (!nextDate) return undefined

    let next = line
        .replace(DONE_DATE_RE, '')              // remove any ✅ date
        .replace(/^([\s>]*[-*+]\s+\[)[^\]]\]/, '$1 ]') // reset checkbox to [ ]

    // Replace the old due/scheduled date with the new one.
    // Try due (📅) first, then scheduled (⏳).
    if (task.due) {
        next = next.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${nextDate}`)
    } else if (task.scheduled) {
        next = next.replace(/⏳\s*\d{4}-\d{2}-\d{2}/, `⏳ ${nextDate}`)
    } else {
        // No date on the original — append the next due date.
        next = next.trimEnd() + ` 📅 ${nextDate}`
    }

    return next.trimEnd()
}

/**
 * Locate the line a task currently occupies.
 *
 * `task.sourceLine` goes stale easily: the index flushes on a debounce, and
 * completing a recurring task splices the next occurrence in *above* the
 * original, shifting every line below it by one. Checking only that the
 * recorded line still looks like a task is not enough — every task line passes
 * that test, so a stale index would silently toggle a neighbour.
 *
 * Matching the full `rawText` instead, at the recorded line or as near to it as
 * possible, means a mismatch is detected rather than written over.
 *
 * Returns the matching line index, or undefined when the task can no longer be
 * identified — in which case the caller must refuse to write.
 */
export function resolveTaskLine(lines: string[], task: Task, searchRadius = 5): number | undefined {
    if (lines[task.sourceLine] === task.rawText) return task.sourceLine

    // Walk outwards so the nearest match to the recorded line wins. That is the
    // best available guess when a file holds several identical task lines.
    for (let offset = 1; offset <= searchRadius; offset++) {
        const before = task.sourceLine - offset
        if (before >= 0 && lines[before] === task.rawText) return before
        const after = task.sourceLine + offset
        if (after < lines.length && lines[after] === task.rawText) return after
    }

    return undefined
}

/**
 * Toggle a task's completion state in the vault, handling recurrence.
 *
 * - Reads the source file.
 * - Re-locates the task by its raw text (see `resolveTaskLine`) and bails out
 *   rather than writing when it can't be found.
 * - Toggles the checkbox and ✅ date.
 * - If completing a recurring task, inserts the next-occurrence line above.
 * - Writes back to the vault.
 */
export async function toggleComplete(task: Task, vault: Vault, todayISO: string): Promise<void> {
    const file = vault.getFileByPath(task.sourcePath)
    // Messages here are surfaced by the caller, which already prefixes them
    // with "Mission Control:" — don't repeat it.
    if (!file) throw new Error(`source file not found: ${task.sourcePath}`)

    await vault.process(file, content => {
        const lines = content.split('\n')
        const lineNumber = resolveTaskLine(lines, task)

        if (lineNumber === undefined) {
            throw new Error(`"${task.text}" has moved or changed in ${task.sourcePath}. Nothing was written — try again in a moment.`)
        }

        const line = lines[lineNumber]
        const toComplete = !task.checked
        lines[lineNumber] = applyToggleToLine(line, toComplete, todayISO)

        if (toComplete && task.recurrence) {
            const nextLine = buildNextRecurrence(line, task, todayISO)
            if (nextLine) lines.splice(lineNumber, 0, nextLine)
        }

        return lines.join('\n')
    })
}
