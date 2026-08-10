import Fuse from "fuse.js";
import type { TFile } from "obsidian";
import type { FileType } from "src/utils/getFileTypeUtils"

export const DEFAULT_FUSE_OPTIONS = {
    includeScore : true,
    // includeMatches : true,
    // findAllMatches : true,
    fieldNormWeight : 1.35,
    threshold : 0.2,
    distance: 125,
    useExtendedSearch : true,
} satisfies Fuse.IFuseOptions<unknown>

function defaultFuseOptions<T>(): Fuse.IFuseOptions<T> {
    return DEFAULT_FUSE_OPTIONS
}

export interface SearchFile{
    name: string
    basename: string
    path: string
    aliases?: string[]
    isCreated: boolean
    isUnresolved?: boolean
    file?: TFile
    extension: string
    fileType?: FileType
}

class fuzzySearch<T>{
    private fuse: Fuse<T>

    constructor(searchArray: T[], searchOptions?: Fuse.IFuseOptions<T>){
        this.fuse = new Fuse(searchArray, searchOptions ?? defaultFuseOptions<T>())
    }

    rawSearch(query: string, limit?: number): Fuse.FuseResult<T>[]{
        return this.fuse.search(query, limit ? {limit: limit} : undefined)
    }

    filteredSearch(query: string, scoreThreshold: number = 0.25, maxResults: number = 5){
        return this.rawSearch(query, maxResults).filter(item => item.score ? item.score < scoreThreshold : true)
    }

    updateSearchArray(newSearchArray: T[]){
        this.fuse.setCollection(newSearchArray)
    }
}

export class ArrayFuzzySearch extends fuzzySearch<string>{
    constructor(searchArray: string[], searchOptions?: Fuse.IFuseOptions<string>){
        super(searchArray, searchOptions)
    }
}

export class FileFuzzySearch extends fuzzySearch<SearchFile>{
    constructor(fileList: SearchFile[], searchOptions?: Fuse.IFuseOptions<SearchFile>){
        const searchArray = fileList
        super(searchArray, searchOptions)
    }

    /**
     * @return Best match between basename and aliases
     */
    getBestMatch(searchResultElement: Fuse.FuseResult<SearchFile>, query: string): string{
        const searchFile = searchResultElement.item
        if (!searchFile.aliases) return searchFile.basename

        const searchArray: string[] = []
        searchArray.push(searchFile.basename)
        searchFile.aliases.forEach((alias) => searchArray.push(alias))

        const fuzzySearch = new ArrayFuzzySearch(searchArray)
        const bestMatch = fuzzySearch.rawSearch(query, 1)[0]
        
        return bestMatch ? bestMatch.item : searchFile.basename
    }
}

/**
 * @description Search image file.
 * @param imageList Optional list of TFile, if not given the search will be in the entire vault.
 */
export class ImageFileFuzzySearch extends fuzzySearch<TFile>{
    constructor(imageList: TFile[], searchOptions?: Fuse.IFuseOptions<TFile>){
        super(imageList, searchOptions)
    }
}
