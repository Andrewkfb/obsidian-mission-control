import { getLinkpath, normalizePath, TFile, TFolder, type App } from 'obsidian'
import type { SearchFile } from '../suggester/fuzzySearch'
import { getExtensionFromFilename, getFileTypeFromExtension } from './getFileTypeUtils'

function getVaultFiles(app: App): TFile[] {
    const fileList: TFile[] = []
    const collectFiles = (folder: TFolder): void => {
        for (const child of folder.children) {
            if (child instanceof TFile) fileList.push(child)
            else if (child instanceof TFolder) collectFiles(child)
        }
    }
    collectFiles(app.vault.getRoot())
    return fileList
}

export function getImageFiles(app: App): TFile[] {
    return getVaultFiles(app).filter(file => getFileTypeFromExtension(file.extension) === 'image')
}

export function getFileAliases(app: App, file: TFile): string[]{
    const aliases: string[] = []
    const rawAliases: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.aliases

    if(Array.isArray(rawAliases)){
        aliases.push(...rawAliases.filter((alias): alias is string => typeof alias === 'string'))
    }
    else if(typeof rawAliases === 'string'){
        rawAliases.replace('[', '').replace(']', '').split(',').forEach((alias: string) => {
            if (alias.length > 0){
                aliases.push(alias.trim())
            }
        })
    }

    return aliases
}

export function generateSearchFile(app: App, file: TFile): SearchFile{
    return {
        name: file.name,
        basename: file.basename,
        path: file.path,
        aliases: getFileAliases(app, file),
        isCreated: true,
        file: file,
        fileType: getFileTypeFromExtension(file.extension),
        extension: file.extension
    }
}

export function getUnresolvedLinkPath(app: App, cachedFilename: string, newFilePath?: boolean): string{
    const normalizedFilename = getLinkpath(cachedFilename)
    if(newFilePath && !normalizedFilename.includes('/')){
        return normalizePath(`${app.fileManager.getNewFileParent('').path}/${normalizedFilename}`)
    }
    return normalizePath(normalizedFilename)
}

export function getUnresolvedLinkBasename(cachedFilename: string): string{
    const normalizedPath = getLinkpath(cachedFilename)
    
    if(normalizedPath.includes('/')){
        const regexResult = normalizedPath.match(/.*\/(.*)/)
        return regexResult ? regexResult[1] : normalizedPath
    }
    return normalizedPath
}

export function generateMarkdownUnresolvedFile(app: App, cachedFilename: string): SearchFile{
    const filename = getExtensionFromFilename(cachedFilename) ? cachedFilename.replace('.md', '') : cachedFilename
    return {
        name: `${getUnresolvedLinkBasename(filename)}.md`,
        basename: getUnresolvedLinkBasename(filename),
        path: getUnresolvedLinkPath(app, `${filename}.md`, true),
        isCreated: false,
        isUnresolved: true,
        fileType: 'markdown',
        extension: 'md'
    }
}

export function getUnresolvedMarkdownFiles(app: App): SearchFile[]{
    const fileList: SearchFile[] = []
    const unresolvedLinkParents = app.metadataCache.unresolvedLinks
    const unresolvedFilenames: string[] = []
    Object.entries(unresolvedLinkParents).forEach(record => {
        Object.keys(record[1]).forEach(filename => {
            // md notes does not have any extension, even if the link is [[somefile.md]]
            if(!getExtensionFromFilename(filename) && !unresolvedFilenames.includes(filename)){
                unresolvedFilenames.push(filename)
            }
        })
    })
    unresolvedFilenames.forEach(filename => fileList.push(generateMarkdownUnresolvedFile(app, filename)))
    return fileList

}

export function getSearchFiles(app: App, unresolvedLinks?: boolean): SearchFile[]{
    const fileList = getVaultFiles(app).map(file => generateSearchFile(app, file))

    if(unresolvedLinks){
        fileList.push(...getUnresolvedMarkdownFiles(app))
    }

    return fileList
}

export function getParentFolderFromPath(filepath: string): string{
    const regexResult = filepath.match(/([^/]+)\/[^/]+\/*$/)
    return regexResult ? regexResult[1] : '/' 
}
