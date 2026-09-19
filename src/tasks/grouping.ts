import type { Task } from './Task'
import { PRIORITY_ORDER, isOpen } from './Task'
import { addDaysISO, daysBetween } from './dates'
import { computeNextDate } from './recurrence'

export interface TaskGroup {
    key: string
    title: string
    tasks: Task[]
}

export interface ProjectSummary {
    project: string
    sourcePath: string
    openCount: number
    // Distinct markdown headings that contain at least one open task, in
    // first-encountered order. Tasks above any heading contribute nothing.
    headings: string[]
}

export interface RecurringEntry {
    task: Task
    // The date the task would next land on after its current occurrence is
    // completed, derived from its 🔁 rule. Undefined when the rule can't be parsed.
    nextDate?: string
}

export interface Dashboard {
    today: TaskGroup[]
    upcoming: TaskGroup[]
    // Everything that is neither actionable today nor inside the upcoming
    // window: undated work, and work dated beyond the horizon. Together with
    // `today` and `upcoming` this accounts for every task, so nothing is
    // silently invisible.
    backlog: TaskGroup[]
    // Recently completed work, newest first. A review surface rather than an
    // inventory, so it only covers the last `completedDays`.
    completed: TaskGroup[]
    projects: ProjectSummary[]
    recurring: RecurringEntry[]
}

/** Sort by priority, then by due date (earliest first), then text. */
function sortTasks(a: Task, b: Task): number {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    const ad = a.due ?? a.scheduled ?? '9999-99-99'
    const bd = b.due ?? b.scheduled ?? '9999-99-99'
    if (ad !== bd) return ad < bd ? -1 : 1
    return a.text.localeCompare(b.text)
}

/** The date used to place a task on a calendar: due wins over scheduled. */
function effectiveDate(task: Task): string | undefined {
    return task.due ?? task.scheduled
}

/** Completed tasks sort newest-first by completion date, then by text. */
function sortCompleted(a: Task, b: Task): number {
    const ad = a.done ?? ''
    const bd = b.done ?? ''
    if (ad !== bd) return ad > bd ? -1 : 1
    return a.text.localeCompare(b.text)
}

/**
 * Group recently completed tasks by their ✅ date.
 *
 * Built from the unfiltered task list, so the Done tab works regardless of the
 * `showCompletedTasks` setting — that setting controls whether completed work
 * also appears in the Today/Upcoming panes.
 *
 * Tasks completed without a ✅ date are left out on purpose: there is no way to
 * tell whether they are recent, and including them would dump a vault's entire
 * completed history into a "recently done" view. Mission Control stamps the date
 * on anything it completes itself.
 */
function buildCompleted(allTasks: Task[], todayISO: string, windowDays: number): TaskGroup[] {
    const yesterdayISO = addDaysISO(todayISO, -1)
    const cutoffISO = addDaysISO(todayISO, -windowDays)

    const doneToday: Task[] = []
    const doneYesterday: Task[] = []
    const doneEarlier: Task[] = []

    for (const task of allTasks) {
        if (!task.checked || !task.done) continue
        if (task.done > todayISO) continue
        if (task.done === todayISO) doneToday.push(task)
        else if (task.done === yesterdayISO) doneYesterday.push(task)
        else if (task.done >= cutoffISO) doneEarlier.push(task)
    }

    const group = (key: string, title: string, list: Task[]): TaskGroup => ({
        key, title, tasks: list.sort(sortCompleted),
    })

    return [
        group('doneToday', 'Today', doneToday),
        group('doneYesterday', 'Yesterday', doneYesterday),
        group('doneEarlier', `Earlier (last ${windowDays} days)`, doneEarlier),
    ].filter(g => g.tasks.length > 0)
}

export function buildDashboard(allTasks: Task[], todayISO: string, opts: { upcomingDays: number; showCompleted: boolean; completedDays: number }): Dashboard {
    const tasks = opts.showCompleted ? allTasks : allTasks.filter(t => !t.checked)

    const overdue: Task[] = []
    const dueToday: Task[] = []
    const scheduledToday: Task[] = []
    const inProgress: Task[] = []

    const tomorrow: Task[] = []
    const nextDays: Task[] = []

    const noDate: Task[] = []
    const later: Task[] = []

    const tomorrowISO = addDaysISO(todayISO, 1)
    const windowEndISO = addDaysISO(todayISO, opts.upcomingDays)

    // Every task lands in exactly one bucket. The chain below is exhaustive by
    // construction — the final `else` is the catch-all — so a task can never
    // fall through and vanish from the dashboard.
    for (const task of tasks) {
        if (!opts.showCompleted && !isOpen(task)) continue

        // --- Today buckets (first match wins) ---
        if (task.due && task.due < todayISO) {
            overdue.push(task)
            continue
        }
        if (task.due === todayISO) {
            dueToday.push(task)
            continue
        }
        // `<=`, not `===`: a task scheduled in the past is available now. With
        // `===` it matched no bucket at all and disappeared.
        if (task.scheduled && task.scheduled <= todayISO) {
            scheduledToday.push(task)
            continue
        }

        // --- Upcoming, then backlog ---
        const eff = effectiveDate(task)
        if (eff === tomorrowISO) {
            tomorrow.push(task)
        } else if (eff && eff > tomorrowISO && eff <= windowEndISO) {
            nextDays.push(task)
        } else if (eff) {
            // Dated, but past the at-a-glance horizon.
            later.push(task)
        } else if (task.status === 'inProgress') {
            // Undated but started: belongs on Today, not in the backlog.
            inProgress.push(task)
        } else {
            noDate.push(task)
        }
    }

    const group = (key: string, title: string, list: Task[]): TaskGroup => ({
        key,
        title,
        tasks: list.sort(sortTasks),
    })

    const today = [
        group('overdue', 'Overdue', overdue),
        group('dueToday', 'Due today', dueToday),
        group('scheduled', 'Scheduled', scheduledToday),
        group('inProgress', 'In progress', inProgress),
    ].filter(g => g.tasks.length > 0)

    const upcoming = [
        group('tomorrow', 'Tomorrow', tomorrow),
        group('nextDays', `Next ${opts.upcomingDays} days`, nextDays),
    ].filter(g => g.tasks.length > 0)

    const backlog = [
        group('noDate', 'No date', noDate),
        group('later', `Beyond ${opts.upcomingDays} days`, later),
    ].filter(g => g.tasks.length > 0)

    // --- Projects: open-task count + distinct headings per source file ---
    const projectMap = new Map<string, ProjectSummary>()
    const seenHeadings = new Map<string, Set<string>>()
    for (const task of tasks) {
        if (!isOpen(task)) continue
        let existing = projectMap.get(task.sourcePath)
        if (existing) {
            existing.openCount++
        } else {
            existing = { project: task.project, sourcePath: task.sourcePath, openCount: 1, headings: [] }
            projectMap.set(task.sourcePath, existing)
            seenHeadings.set(task.sourcePath, new Set())
        }
        if (task.heading) {
            const seen = seenHeadings.get(task.sourcePath)!
            if (!seen.has(task.heading)) {
                seen.add(task.heading)
                existing.headings.push(task.heading)
            }
        }
    }
    const projects = [...projectMap.values()].sort((a, b) => b.openCount - a.openCount || a.project.localeCompare(b.project))

    // --- Recurring: every open task with a 🔁 rule, sorted by its next occurrence ---
    const recurring: RecurringEntry[] = tasks
        .filter((task): task is Task & { recurrence: string } => isOpen(task) && !!task.recurrence)
        .map(task => ({ task, nextDate: computeNextDate(task.recurrence, effectiveDate(task) ?? todayISO) }))
        .sort((a, b) => {
            const ad = a.nextDate ?? '9999-99-99'
            const bd = b.nextDate ?? '9999-99-99'
            if (ad !== bd) return ad < bd ? -1 : 1
            return a.task.text.localeCompare(b.task.text)
        })

    const completed = buildCompleted(allTasks, todayISO, opts.completedDays)

    return { today, upcoming, backlog, completed, projects, recurring }
}

/** Whole-day overdue amount for a task, for the "3d overdue" badge. */
export function overdueByDays(task: Task, todayISO: string): number {
    if (!task.due || task.due >= todayISO) return 0
    return daysBetween(task.due, todayISO)
}
