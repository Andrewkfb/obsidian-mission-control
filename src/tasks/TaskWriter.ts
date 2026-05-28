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
 * Toggle a task's completion state in the vault, handling recurrence.
 *
 * - Reads the source file.
 * - Verifies the line at task.sourceLine still looks like the task (guards
 *   against index being stale if the file was edited between index and click).
 * - Toggles the checkbox and ✅ date.
 * - If completing a recurring task, inserts the next-occurrence line above.
 * - Writes back to the vault.
 */
export async function toggleComplete(task: Task, vault: Vault, todayISO: string): Promise<void> {
    const file = vault.getFileByPath(task.sourcePath)
    if (!file) throw new Error(`Mission Control: source file not found: ${task.sourcePath}`)

    const content = await vault.read(file)
    const lines = content.split('\n')

    const line = lines[task.sourceLine]
    if (line === undefined) throw new Error(`Mission Control: line ${task.sourceLine} not found in ${task.sourcePath}`)

    // Soft guard: if the line no longer starts with a checkbox, bail gracefully
    // rather than corrupting the file (user may have edited it since last index).
    if (!CHECKBOX_RE.test(line)) {
        console.warn(`Mission Control: line ${task.sourceLine} in ${task.sourcePath} no longer looks like a task — skipping write-back.`)
        return
    }

    const toComplete = !task.checked
    const toggled = applyToggleToLine(line, toComplete, todayISO)
    lines[task.sourceLine] = toggled

    // Handle recurrence: when completing a recurring task, splice a fresh
    // open copy with the next date directly above the completed line.
    if (toComplete && task.recurrence) {
        const nextLine = buildNextRecurrence(line, task, todayISO)
        if (nextLine) {
            lines.splice(task.sourceLine, 0, nextLine)
        }
    }

    await vault.modify(file, lines.join('\n'))
}
