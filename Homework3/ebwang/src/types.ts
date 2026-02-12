export interface Margin {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}

export interface ComponentSize {
    width: number;
    height: number;
}

export interface ParallelCoordinateData {
    readonly artistName: string;
    readonly artistPopularity: number;
    readonly artistFollowers: number;
    readonly numberOfTracks: number;
    readonly averageTrackPopularity: number;
    readonly trackPopularityLow: number;
    readonly trackPopularityHigh: number;
}

export interface BarGraphData {
    readonly artistName: string;
    readonly trackName: string;
    readonly trackPopularity: number;
}

export interface ScatterPlotData {
    readonly artistName: string;
    readonly trackName?: string;
    readonly artistFollowers: number;
    readonly trackPopularity: number;
}