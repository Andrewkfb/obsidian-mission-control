// Positioning for the suggestion popover.
//
// This replaces @popperjs/core, which was pulled in for exactly one thing:
// "put this under that, flip it above when there is no room, and keep it on
// screen". That is a dozen lines of arithmetic, so the dependency cost — and a
// whole positioning engine in the bundle — bought very little.
//
// The maths lives in `anchorPosition`, free of the DOM, so the flip and clamp
// behaviour is covered by tests rather than only by looking at it.

export interface AnchorRect {
    top: number
    bottom: number
    left: number
}

export interface AnchorSize {
    width: number
    height: number
}

export interface AnchorViewport {
    width: number
    height: number
}

export interface AnchorPoint {
    top: number
    left: number
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

/**
 * Where to put a popover of `size` anchored beneath `reference`.
 *
 * Prefers below with a `gap`, flips above when there is genuinely more room
 * there, and clamps so the popover stays within the viewport. Coordinates are
 * viewport-relative, for `position: fixed`.
 *
 * Horizontal clamping uses 0 rather than `gap`, so a full-width popover (the
 * phone layout) sits flush instead of hanging off the right edge.
 */
export function anchorPosition(
    reference: AnchorRect,
    size: AnchorSize,
    viewport: AnchorViewport,
    gap = 5,
): AnchorPoint {
    const roomBelow = viewport.height - reference.bottom - gap
    const roomAbove = reference.top - gap
    const flip = roomBelow < size.height && roomAbove > roomBelow

    const preferredTop = flip ? reference.top - gap - size.height : reference.bottom + gap

    return {
        top: clamp(preferredTop, gap, Math.max(gap, viewport.height - size.height - gap)),
        left: clamp(reference.left, 0, Math.max(0, viewport.width - size.width)),
    }
}

/**
 * Keep `el` anchored beneath `reference` until the returned cleanup runs.
 *
 * The position is published as CSS custom properties rather than written to
 * `style` directly, so `position: fixed` and the rest live in styles.css where
 * a theme or snippet can reach them.
 *
 * Re-positions on resize and on scroll anywhere in the page (capture phase, so
 * scrolling an inner container counts), and on the popover's own size changing
 * — it is filled with suggestions after it is created.
 */
export function anchorTo(reference: HTMLElement, el: HTMLElement, gap = 5): () => void {
    const place = (): void => {
        const rect = reference.getBoundingClientRect()
        const { top, left } = anchorPosition(
            { top: rect.top, bottom: rect.bottom, left: rect.left },
            { width: el.offsetWidth, height: el.offsetHeight },
            { width: window.innerWidth, height: window.innerHeight },
            gap,
        )
        el.setCssProps({
            '--mc-anchor-top': `${top}px`,
            '--mc-anchor-left': `${left}px`,
        })
    }

    place()

    const listenerOptions = { passive: true, capture: true } as const
    window.addEventListener('resize', place, listenerOptions)
    window.addEventListener('scroll', place, listenerOptions)
    const observer = new ResizeObserver(place)
    observer.observe(el)

    return () => {
        window.removeEventListener('resize', place, listenerOptions)
        window.removeEventListener('scroll', place, listenerOptions)
        observer.disconnect()
    }
}
