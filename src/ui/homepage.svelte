<script lang="ts">
    import { TFile } from "obsidian"
    import type HomeTab from "src/main"
    import type HomeTabSearchBar from "src/homeTabSearchbar"
    import { pluginSettingsStore } from "src/store"
    import SearchBar from "./searchBar.svelte"
    import TaskDashboard from "./tasks/TaskDashboard.svelte"
    import ObsidianIcon from "./svelteComponents/ObsidianIcon.svelte"

    export let HomeTabSearchBar: HomeTabSearchBar
    export let plugin: HomeTab

    $: settings = $pluginSettingsStore
    $: logoIcon = settings.logoType === "lucideIcon" ? settings.logo.lucideIcon : "obsidian"
    $: logoFile = plugin.app.vault.getAbstractFileByPath(settings.logo.imagePath)
    $: localLogoUrl = logoFile instanceof TFile ? plugin.app.vault.getResourcePath(logoFile) : ""
    $: titleFont = settings.customFont === "interfaceFont"
        ? "var(--interface-font)"
        : settings.customFont === "textFont"
        ? "var(--font-text)"
        : settings.customFont === "monospaceFont"
        ? "var(--font-monospace)"
        : settings.font
    $: titleColor = settings.fontColorType === "accentColor"
        ? "var(--interactive-accent)"
        : settings.fontColorType === "custom"
        ? settings.fontColor
        : "inherit"
    $: iconColor = settings.iconColorType === "accentColor"
        ? "var(--interactive-accent)"
        : settings.iconColorType === "custom"
        ? settings.iconColor
        : "currentColor"
    $: appearance = [
        `--mc-logo-scale:${settings.logoScale}`,
        `--mc-title-font:${titleFont}`,
        `--mc-title-size:${settings.fontSize}`,
        `--mc-title-weight:${settings.fontWeight}`,
        `--mc-title-color:${titleColor}`,
        `--mc-icon-color:${iconColor}`,
    ].join(";")
</script>

<main class="home-tab" style={appearance}>
    <div class="home-tab-wordmark-container">
        {#if settings.logoType !== "none"}
            <div class="home-tab-logo">
                {#if settings.logoType === "default" || settings.logoType === "oldLogo"}
                    <ObsidianIcon icon="obsidian" size="logo" />
                {:else if settings.logoType === "lucideIcon" && logoIcon}
                    <ObsidianIcon icon={logoIcon} size="logo" />
                {:else if settings.logoType === "imagePath" && localLogoUrl}
                    <img src={localLogoUrl} alt="Mission Control" />
                {:else if settings.logoType === "imageLink" && settings.logo.imageLink}
                    <img src={settings.logo.imageLink} alt="Mission Control" />
                {/if}
            </div>
        {/if}
        <h1>{settings.wordmark}</h1>
    </div>

    <SearchBar {HomeTabSearchBar} />
    <TaskDashboard {plugin} />
</main>

<style>
    .home-tab-wordmark-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: calc(var(--mc-title-size) / 5);
        margin-bottom: 50px;
        padding-top: 100px;
    }
    .home-tab-logo {
        color: var(--mc-icon-color);
    }
    .home-tab-logo img {
        width: calc(var(--mc-title-size) * var(--mc-logo-scale));
        height: calc(var(--mc-title-size) * var(--mc-logo-scale));
        object-fit: contain;
    }
    h1 {
        margin: 0;
        color: var(--mc-title-color);
        font-family: var(--mc-title-font);
        font-size: var(--mc-title-size);
        font-weight: var(--mc-title-weight);
    }
    @media (max-width: 600px) {
        .home-tab-wordmark-container {
            gap: 8px;
            margin-bottom: 12px;
            padding-top: 8px;
        }
        h1 { font-size: 1.8em; }
        .home-tab-logo { transform: scale(0.45); }
    }
    @media (max-height: 1000px) {
        .home-tab-wordmark-container { padding-top: 10px; }
    }
</style>
