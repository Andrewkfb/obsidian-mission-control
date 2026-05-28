import type { Task } from './Task'
import { PRIORITY_ORDER, isOpen } from './Task'
import { addDaysISO, daysBetween } from './dates'

export interface TaskGroup {
    key: string
    title: string
    tasks: Task[]
}

export interface ProjectSummary {
    project: string
    sourcePath: string
    openCount: number
}

export interface Dashboard {
    today: TaskGroup[]
    upcoming: TaskGroup[]
    projects: ProjectSummary[]
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

export function buildDashboard(allTasks: Task[], todayISO: string, opts: { upcomingDays: number; showCompleted: boolean }): Dashboard {
    const tasks = opts.showCompleted ? allTasks : allTasks.filter(t => !t.checked)

    const overdue: Task[] = []
    const dueToday: Task[] = []
    const scheduledToday: Task[] = []
    const inProgress: Task[] = []

    const tomorrow: Task[] = []
    const nextDays: Task[] = []
    const unscheduled: Task[] = []

    const tomorrowISO = addDaysISO(todayISO, 1)
    const windowEndISO = addDaysISO(todayISO, opts.upcomingDays)

    for (const task of tasks) {
        if (!isOpen(task)) continue

        // --- Today buckets (each task lands in at most one, by priority) ---
        if (task.due && task.due < todayISO) {
            overdue.push(task)
            continue
        }
        if (task.due === todayISO) {
            dueToday.push(task)
            continue
        }
        if (task.scheduled === todayISO) {
            scheduledToday.push(task)
            continue
        }

        // --- Upcoming buckets ---
        const eff = effectiveDate(task)
        if (eff === tomorrowISO) {
            tomorrow.push(task)
        } else if (eff && eff > tomorrowISO && eff <= windowEndISO) {
            nextDays.push(task)
        } else if (!eff) {
            // No date at all. In-progress with no date surfaces on Today; the rest are unscheduled.
            if (task.status === 'inProgress') inProgress.push(task)
            else unscheduled.push(task)
        }
        // eff beyond the window is intentionally dropped from the at-a-glance view.
    }

    const group = (key: string, title: string, list: Task[]): TaskGroup => ({
        key,
        title,
        tasks: list.sort(sortTasks),
    })

    const today = [
        group('overdue', 'Overdue', overdue),
        group('dueToday', 'Due today', dueToday),
        group('scheduledToday', 'Scheduled today', scheduledToday),
        group('inProgress', 'In progress', inProgress),
    ].filter(g => g.tasks.length > 0)

    const upcoming = [
        group('tomorrow', 'Tomorrow', tomorrow),
        group('nextDays', `Next ${opts.upcomingDays} days`, nextDays),
        group('unscheduled', 'Unscheduled', unscheduled),
    ].filter(g => g.tasks.length > 0)

    // --- Projects: open-task count per source file ---
    const projectMap = new Map<string, ProjectSummary>()
    for (const task of tasks) {
        if (!isOpen(task)) continue
        const existing = projectMap.get(task.sourcePath)
        if (existing) existing.openCount++
        else projectMap.set(task.sourcePath, { project: task.project, sourcePath: task.sourcePath, openCount: 1 })
    }
    const projects = [...projectMap.values()].sort((a, b) => b.openCount - a.openCount || a.project.localeCompare(b.project))

    return { today, upcoming, projects }
}

/** Whole-day overdue amount for a task, for the "3d overdue" badge. */
export function overdueByDays(task: Task, todayISO: string): number {
    if (!task.due || task.due >= todayISO) return 0
    return daysBetween(task.due, todayISO)
}
