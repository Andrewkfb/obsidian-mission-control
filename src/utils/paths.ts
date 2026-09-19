// Path helpers for the folder-scoped features (the task source folder and the
// inbox). Both compare whole path segments, so a folder named "Inbox" never
// matches a sibling named "Inbox Archive" — the classic prefix bug.
//
// An empty `folder` means "not configured" and matches nothing.

/** True when `path` sits anywhere beneath `folder`, at any depth. */
export function isInFolder(path: string, folder: string): boolean {
    if (!folder) return false
    return path === folder || path.startsWith(folder + '/')
}

/** True when `path` is an immediate child of `folder`, with no subfolder between. */
export function isDirectChildOf(path: string, folder: string): boolean {
    if (!folder) return false
    const slash = path.lastIndexOf('/')
    return (slash === -1 ? '' : path.slice(0, slash)) === folder
}
