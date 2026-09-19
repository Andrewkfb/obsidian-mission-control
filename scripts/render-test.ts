import { render } from 'svelte/server'
import { parseTaskLine } from '../src/tasks/TaskParser'
import { buildDashboard } from '../src/tasks/grouping'
import { pluginSettingsStore } from '../src/store'
import { DEFAULT_SETTINGS } from '../src/settings'
import TodayTab from '../src/ui/tasks/tabs/TodayTab.svelte'
import UpcomingTab from '../src/ui/tasks/tabs/UpcomingTab.svelte'
import BacklogTab from '../src/ui/tasks/tabs/BacklogTab.svelte'
import DoneTab from '../src/ui/tasks/tabs/DoneTab.svelte'
import QuickAdd from '../src/ui/tasks/QuickAdd.svelte'
import RecurringTab from '../src/ui/tasks/tabs/RecurringTab.svelte'
import ProjectsTab from '../src/ui/tasks/tabs/ProjectsTab.svelte'
import TaskItem from '../src/ui/tasks/TaskItem.svelte'
import TagFilterButton from '../src/ui/tasks/TagFilterButton.svelte'

/** The rendered <input>/<button> open tag, so assertions can target one element. */
const tagAfter = (body: string, marker: string) => {
    const i = body.indexOf(marker)
    return i === -1 ? '' : body.slice(i, body.indexOf('>', i) + 1)
}
const inputTag = (body: string) => tagAfter(body, '<input')
const buttonTag = (body: string) => tagAfter(body, '<button')

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
const completedTasks = [
    { ...mk('- [x] Shipped the thing'), done: TODAY },
    { ...mk('- [x] Older win'), done: '2026-05-26' },
]
const dashboard = buildDashboard([...tasks, ...completedTasks], TODAY, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
const app = { vault: { getAbstractFileByPath: () => null }, workspace: {} }
const noop = () => {}
const noopToggle = async () => true

console.log('SSR render smoke tests:')
{
    const { body } = render(TodayTab, { props: { app, dashboard, todayISO: TODAY, activeProject: null, ontoggle: noopToggle, onclearProject: noop } })
    assert(body.includes('Overdue thing'), 'TodayTab renders an overdue task')
    assert(body.includes('Due today'), 'TodayTab renders a due-today task')
    assert(body.includes('8d overdue'), 'TodayTab renders the overdue badge')
    assert(body.includes('⏫'), 'TodayTab renders the priority marker')
    assert(body.includes('Proj'), 'TodayTab renders the project chip')
    assert(!body.includes('Undated backlog thing'), 'TodayTab excludes backlog tasks')
}
{
    const { body } = render(UpcomingTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noopToggle } })
    assert(body.includes('Tomorrow thing'), 'UpcomingTab renders a tomorrow task')
    assert(body.includes('Tomorrow'), 'UpcomingTab renders the group heading')
}
{
    const { body } = render(BacklogTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noopToggle } })
    assert(body.includes('Undated backlog thing'), 'BacklogTab renders the undated task')
    assert(body.includes('Far future'), 'BacklogTab renders the beyond-window task')
    assert(body.includes('No date'), 'BacklogTab renders the noDate group title')
}
{
    const { body } = render(RecurringTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noopToggle } })
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
    const { body } = render(TaskItem, { props: { app, task: linked, todayISO: TODAY, ontoggle: noopToggle } })
    assert(body.includes('<a'), 'TaskItem renders a wikilink as an anchor')
    assert(body.includes('>note<'), 'TaskItem uses the wikilink display text')
    // Accessibility contract: the row is not itself a control, the checkbox is a
    // real checkbox labelled with the task it belongs to, and opening the task
    // has its own focusable button.
    assert(body.includes('role="checkbox"'), 'TaskItem checkbox uses role=checkbox')
    assert(body.includes('aria-checked="false"'), 'TaskItem checkbox exposes its checked state')
    assert(!body.includes('role="button"'), 'TaskItem row is not itself a button')
    assert(!body.includes('aria-pressed'), 'TaskItem checkbox is not a toggle button')
    assert(body.includes('Open task in Proj'), 'TaskItem renders a labelled open button')
    // Native buttons and anchors already activate on Enter/Space. Keydown handlers
    // alongside them fire a second time, which opened wikilinks twice in a new tab.
    assert(!body.includes('onkeydown'), 'TaskItem adds no keydown handlers that duplicate native activation')
}
{
    const done = mk('- [x] Finished thing 📅 2026-05-28')
    const { body } = render(TaskItem, { props: { app, task: done, todayISO: TODAY, ontoggle: noopToggle } })
    assert(body.includes('aria-checked="true"'), 'TaskItem reflects a completed task as checked')
}
{
    const { body } = render(DoneTab, { props: { app, dashboard, todayISO: TODAY, ontoggle: noopToggle } })
    assert(body.includes('Shipped the thing'), 'DoneTab renders work completed today')
    assert(body.includes('Older win'), 'DoneTab renders work completed earlier in the window')
    assert(body.includes('Today'), 'DoneTab groups by completion date')
}
{
    const { body } = render(QuickAdd, {
        props: { targetPath: 'Inbox.md', targetLabel: 'Inbox', targetIsProject: false, oncreate: async () => true },
    })
    assert(body.includes('Add a task'), 'QuickAdd offers the input when a target is set')
    assert(body.includes('Inbox'), 'QuickAdd names the note it captures into')
    assert(!inputTag(body).includes('disabled'), 'QuickAdd input is enabled when a target is set')
    // The button stays disabled until something is typed, which is the point.
    assert(buttonTag(body).includes('disabled'), 'QuickAdd will not submit an empty task')
}
{
    // With nothing configured the control must explain itself rather than silently fail.
    const { body } = render(QuickAdd, {
        props: { targetPath: null, targetLabel: '', targetIsProject: false, oncreate: async () => true },
    })
    assert(inputTag(body).includes('disabled'), 'QuickAdd input is disabled with no target configured')
    assert(body.includes('settings'), 'QuickAdd explains how to enable itself')
}
{
    const { body } = render(QuickAdd, {
        props: { targetPath: 'Proj.md', targetLabel: 'Proj', targetIsProject: true, oncreate: async () => true },
    })
    assert(body.includes('selected project'), 'QuickAdd says when it is capturing into the active project')
}
{
    const { body } = render(TagFilterButton, { props: { availableTags: ['work', 'home'], activeTags: ['work'], onchange: noop } })
    assert(body.includes('Tag filter (1 active)'), 'TagFilterButton reflects the active-filter count')
}

console.log(`\n${failures === 0 ? 'ALL RENDER TESTS PASSED' : failures + ' FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
