import type { Task, TaskStatus, TaskPriority } from './Task'

// Matches a markdown task line: optional indent, list marker, [x] checkbox, text.
// Captures: 1=status char, 2=remainder.
const TASK_LINE = /^[\s>]*[-*+]\s+\[(.)\]\s+(.*)$/

const ISO_DATE = /(\d{4}-\d{2}-\d{2})/

// Tasks-plugin emoji field markers.
const EMOJI_FIELDS: { key: keyof Pick<Task, 'due' | 'scheduled' | 'start' | 'done' | 'created'>; emoji: string }[] = [
    { key: 'due', emoji: '📅' },
    { key: 'scheduled', emoji: '⏳' },
    { key: 'start', emoji: '🛫' },
    { key: 'done', emoji: '✅' },
    { key: 'created', emoji: '➕' },
]

// Dataview inline field aliases -> Task date keys.
const DV_DATE_ALIASES: Record<string, keyof Pick<Task, 'due' | 'scheduled' | 'start' | 'done' | 'created'>> = {
    due: 'due',
    scheduled: 'scheduled',
    start: 'start',
    completion: 'done',
    done: 'done',
    created: 'created',
}

const PRIORITY_EMOJI: { emoji: string; priority: TaskPriority }[] = [
    { emoji: '🔺', priority: 'highest' },
    { emoji: '⏫', priority: 'high' },
    { emoji: '🔼', priority: 'low' },     // Tasks: 🔼 = medium; we fold medium->low side below
    { emoji: '🔽', priority: 'low' },
    { emoji: '⏬', priority: 'lowest' },
]

function statusFromChar(char: string): TaskStatus {
    switch (char) {
        case 'x':
        case 'X':
            return 'done'
        case '/':
            return 'inProgress'
        case '-':
            return 'cancelled'
        case ' ':
            return 'open'
        default:
            return 'other'
    }
}

/** Parse one line. Returns a Task or null if the line is not a task. */
export function parseTaskLine(line: string, sourcePath: string, lineNumber: number, project: string): Task | null {
    const match = line.match(TASK_LINE)
    if (!match) return null

    const statusChar = match[1]
    let body = match[2]

    const status = statusFromChar(statusChar)
    const checked = status === 'done' || status === 'cancelled'

    const task: Task = {
        sourcePath,
        sourceLine: lineNumber,
        rawText: line,
        text: '',
        status,
        statusChar,
        checked,
        priority: 'normal',
        tags: [],
        project,
    }

    // Emoji date fields: "📅 2026-06-01"
    for (const { key, emoji } of EMOJI_FIELDS) {
        const re = new RegExp(`${emoji}\\s*${ISO_DATE.source}`)
        const m = body.match(re)
        if (m) {
            task[key] = m[1]
            body = body.replace(m[0], ' ')
        }
    }

    // Priority emoji
    for (const { emoji, priority } of PRIORITY_EMOJI) {
        if (body.includes(emoji)) {
            task.priority = priority
            body = body.replace(emoji, ' ')
        }
    }

    // Recurrence: "🔁 every week" — capture rule text up to the next emoji/field/EOL.
    const recMatch = body.match(/🔁\s*([^📅⏳🛫✅➕🔺⏫🔼🔽⏬\n]+)/)
    if (recMatch) {
        task.recurrence = recMatch[1].trim()
        body = body.replace(recMatch[0], ' ')
    }

    // Dataview inline fields: [key:: value] or (key:: value)
    const dvRe = /[\[(]\s*([\w-]+)\s*::\s*([^\])]+?)\s*[\])]/g
    let dvMatch: RegExpExecArray | null
    const dvToStrip: string[] = []
    while ((dvMatch = dvRe.exec(body)) !== null) {
        const fieldKey = dvMatch[1].toLowerCase()
        const value = dvMatch[2].trim()
        const dateKey = DV_DATE_ALIASES[fieldKey]
        if (dateKey && !task[dateKey]) {
            const iso = value.match(ISO_DATE)
            if (iso) task[dateKey] = iso[1]
        } else if (fieldKey === 'priority' && task.priority === 'normal') {
            const p = value.toLowerCase()
            if (p === 'highest' || p === 'high' || p === 'low' || p === 'lowest') task.priority = p as TaskPriority
        } else if (fieldKey === 'repeat' || fieldKey === 'recurrence') {
            if (!task.recurrence) task.recurrence = value
        }
        dvToStrip.push(dvMatch[0])
    }
    for (const s of dvToStrip) body = body.replace(s, ' ')

    // Tags: #foo, #foo/bar. Collect into tags[] and strip from display text.
    const tagRe = /(^|\s)#([\w/-]+)/g
    let tagMatch: RegExpExecArray | null
    while ((tagMatch = tagRe.exec(body)) !== null) {
        task.tags.push(tagMatch[2])
    }
    body = body.replace(/(^|\s)#[\w/-]+/g, ' ')

    // Clean display text: collapse whitespace.
    task.text = body.replace(/\s+/g, ' ').trim()

    return task
}

/** Parse an entire file's contents into tasks. */
export function parseTasks(content: string, sourcePath: string, project: string): Task[] {
    const tasks: Task[] = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
        const task = parseTaskLine(lines[i], sourcePath, i, project)
        if (task) tasks.push(task)
    }
    return tasks
}
