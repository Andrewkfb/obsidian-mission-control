<script lang="ts">
    import { setIcon } from "obsidian"

    interface Props {
        icon: string
        size?: "small" | "medium" | "logo"
        label?: string
    }

    let { icon, size = "medium", label = undefined }: Props = $props()

    let element = $state<HTMLSpanElement>()

    $effect(() => {
        if (element && icon) setIcon(element, icon)
    })
</script>

<span
    bind:this={element}
    class="mc-icon"
    class:mc-icon-small={size === "small"}
    class:mc-icon-logo={size === "logo"}
    aria-label={label}
    aria-hidden={!label}
></span>

<style>
    .mc-icon {
        display: inline-flex;
    }
    .mc-icon :global(svg) {
        width: 24px;
        height: 24px;
    }
    .mc-icon-small :global(svg) {
        width: 15px;
        height: 15px;
    }
    .mc-icon-logo :global(svg) {
        width: calc(var(--mc-title-size) * var(--mc-logo-scale));
        height: calc(var(--mc-title-size) * var(--mc-logo-scale));
    }
</style>
