import { render } from 'svelte/server'
import { parseTaskLine } from '../src/tasks/TaskParser'
import { buildDashboard } from '../src/tasks/grouping'
import { pluginSettingsStore } from '../src/store'
import { DEFAULT_SETTINGS } from '../src/settings'
import TodayTab from '../src/ui/tasks/tabs/TodayTab.svelte'
import UpcomingTab from '../src/ui/tasks/tabs/UpcomingTab.svelte'
import BacklogTab from '../src/ui/tasks/tabs/BacklogTab.svelte'
import RecurringTab from '../src/ui/tasks/tabs/RecurringTab.svelte'
import ProjectsTab from '../src/ui/tasks/tabs/ProjectsTab.svelte'
import TaskItem from '../src/ui/tasks/TaskItem.svelte'
import TagFilterButton from '../src/ui/tasks/TagFilterButton.svelte'

let failures = 0
function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('  ✗ ' + msg); failures++ } else console.log('  ✓ ' + msg)
}

pluginSettingsStore.set({ ...DEFAULT_SETTINGS })

const TODAY = '2026-05-28'
const mk = (line: string, over: Record<string, unknown> = {}) =>
    ({ ...parseTaskLine(line, 'Proj.md', 0, 'Proj')!, ...over })

const tasks = [
    mk('- [ ] Overdue thing 📅 2026-05-20 ⏫'),
    mk('- [ ] Due today 📅 2026-05-28'),
    mk('- [ ] Tomorrow thing 📅 2026-05-29'),
    mk('- [ ] Undated backlog thing'),
    mk('- [ ] Far future 📅 2026-12-01'),
    mk('- [ ] Standup 🔁 every day 📅 2026-05-28'),
    mk('- [ ] Linked [[Some Note|note]] task 📅 2026-05-28'),
]
const dashboard = buildDashboard(tasks, TODAY, { upcomingDays: 7, showCompleted: false })
const app = { vault: { getAbstractFileByPath: () => null }, workspace: {} }
const noop = () => {}

console.log('SSR render smoke tests:')
{
    const { body } = render(TodayTab, { props: { app, dashboard, todayISO: TODAY, activeProject: null, ontoggle: noop, onclearProject: noop } })
    assert(body.includes('Overdue thing'), 'TodayTab renders an overdue task')
    assert(body.includes('Due today'), 'TodayTab renders a due-today task')
    assert(body.includes('8d overdue'), 'TodayTab renders the overdue badge')
    assert(body.includes('⏫'), 'TodayTab renders the priority marker')
    assert(body.includes('Proj'), 'TodayTab renders the project chip')
    assert(!body.includes('Undated backlog thing'), 'TodayTab excludes backlog tasks')
}
{
    const { body } = render(UpcomingTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noop } })
    assert(body.includes('Tomorrow thing'), 'UpcomingTab renders a tomorrow task')
    assert(body.includes('Tomorrow'), 'UpcomingTab renders the group heading')
}
{
    const { body } = render(BacklogTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noop } })
    assert(body.includes('Undated backlog thing'), 'BacklogTab renders the undated task')
    assert(body.includes('Far future'), 'BacklogTab renders the beyond-window task')
    assert(body.includes('No date'), 'BacklogTab renders the noDate group title')
}
{
    const { body } = render(RecurringTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noop } })
    assert(body.includes('Standup'), 'RecurringTab renders the recurring task')
    assert(body.includes('every day'), 'RecurringTab renders the recurrence rule')
    assert(body.includes('next'), 'RecurringTab renders the next-occurrence label')
}
{
    const { body } = render(ProjectsTab, { props: { app, dashboard, activeProject: null, onselectProject: noop } })
    assert(body.includes('Proj'), 'ProjectsTab renders the project name')
    assert(body.includes('7'), 'ProjectsTab renders the open-task count')
}
{
    // Wikilink segmentation is $derived now — check it still splits into an anchor.
    const linked = tasks.find(t => t.text.includes('['))!
    const { body } = render(TaskItem, { props: { app, task: linked, todayISO: TODAY, ontoggle: noop } })
    assert(body.includes('<a'), 'TaskItem renders a wikilink as an anchor')
    assert(body.includes('>note<'), 'TaskItem uses the wikilink display text')
    assert(body.includes('Mark as done'), 'TaskItem renders the checkbox with its aria-label')
}
{
    const { body } = render(TagFilterButton, { props: { availableTags: ['work', 'home'], activeTags: ['work'], onchange: noop } })
    assert(body.includes('Tag filter (1 active)'), 'TagFilterButton reflects the active-filter count')
}

console.log(`\n${failures === 0 ? 'ALL RENDER TESTS PASSED' : failures + ' FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
