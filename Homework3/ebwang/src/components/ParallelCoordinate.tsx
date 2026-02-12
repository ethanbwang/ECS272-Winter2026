import React from "react"
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { isEmpty } from "lodash";
import { useResizeObserver, useDebounceCallback } from "usehooks-ts";

import { ComponentSize, Margin, ParallelCoordinateData } from "../types";
import { useSelectedArtist } from "../context/SelectedArtistContext";

const TOOLTIP_OFFSET = 12;

const axesLabelMap: Record<keyof ParallelCoordinateData, string> = {
    artistName: "",
    artistFollowers: "Artist # Followers",
    artistPopularity: "Artist Pop. (max 100)",
    numberOfTracks: "Artist # Tracks",
    averageTrackPopularity: "Avg. Track Pop. (max 100)",
    trackPopularityLow: "Lowest Track Pop. (max 100)",
    trackPopularityHigh: "Highest Track Pop. (max 100)",
};

function formatDimensionValue(dim: keyof ParallelCoordinateData, value: number): string {
    if (dim === "artistFollowers") return d3.format("~s")(value);
    if (dim === "numberOfTracks") return d3.format("~s")(value);
    return String(Math.round(value * 10) / 10);
}

export default function ParallelCoordinate() {
    const { selectedArtist } = useSelectedArtist();
    const [parallelCoordinateDatapoints, setParallelCoordinateDatapoints] = useState<ParallelCoordinateData[]>([]);
    const parallelCoordinateRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
    const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; d: ParallelCoordinateData } | null>(null);
    const margin: Margin = { top: 40, right: 0, bottom: 20, left: 0 };
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200);

    useResizeObserver({ ref: parallelCoordinateRef as React.RefObject<HTMLDivElement>, onResize });

    useEffect(() => {
        setHoverTooltip(null);
    }, [selectedArtist]);

    useEffect(() => {
        // For reading csv file
        const dataFromCSV = async () => {
            try {
                const spotifyDataCleanData = await d3.csv("../../data/spotify_data_clean.csv", d => {
                    return {
                        artist_name: d.artist_name,
                        artist_popularity: d.artist_popularity,
                        artist_followers: d.artist_followers,
                        track_name: d.track_name,
                        track_popularity: d.track_popularity,
                    };
                });

                const trackDataFinalData = await d3.csv("../../data/track_data_final.csv", d => {
                    return {
                        artist_name: d.artist_name,
                        artist_popularity: d.artist_popularity,
                        artist_followers: d.artist_followers,
                        track_name: d.track_name,
                        track_popularity: d.track_popularity,
                    };
                });

                const allData = spotifyDataCleanData.concat(trackDataFinalData);

                const cleanedData = allData
                    .map((d) => {
                        // Clean data and map to proper types
                        const artistName = d.artist_name?.trim() ?? "";
                        const artistPopularity = Number(d.artist_popularity);
                        const artistFollowers = Number(d.artist_followers);
                        const trackName = d.track_name?.trim() ?? "";
                        const trackPopularity = Number(d.track_popularity);

                        return {
                            artistName,
                            artistPopularity,
                            artistFollowers,
                            trackName,
                            trackPopularity,
                        };
                    })
                    .filter((d) => {
                        // Remove bad data
                        if (!d.artistName) return false;
                        if (d.artistName === "TRUE" || d.artistName === "FALSE") return false;
                        if (!Number.isFinite(d.artistPopularity)) return false;
                        if (!Number.isFinite(d.artistFollowers)) return false;
                        if (!d.trackName) return false;
                        if (!Number.isFinite(d.trackPopularity)) return false;
                        return true;
                    });

                // Filter out repeat tracks and group by artist
                const perArtist = d3.rollups(
                    cleanedData,
                    (v) => {
                        const firstArtistRow = v[0];
                        const popByTrackName = new Map<string, number>();
                        for (const row of v) {
                            const trackName = (row.trackName ?? "").trim();
                            if (!trackName) continue;

                            const key = trackName.toLocaleLowerCase();
                            const pop = +row.trackPopularity;
                            if (!Number.isFinite(pop)) continue;

                            const prev = popByTrackName.get(key);
                            if (prev === undefined || pop > prev) popByTrackName.set(key, pop);
                        }

                        const pops = popByTrackName.size > 0
                            ? Array.from(popByTrackName.values())
                            : v.map(d => +d.trackPopularity).filter((p) => Number.isFinite(p));

                        return {
                            artistPopularity: +firstArtistRow.artistPopularity,
                            artistFollowers: +firstArtistRow.artistFollowers,
                            numberOfTracks: pops.length,
                            averageTrackPopularity: d3.mean(pops) ?? 0,
                            trackPopularityLow: d3.min(pops) ?? 0,
                            trackPopularityHigh: d3.max(pops) ?? 0,
                        };
                    },
                    d => d.artistName
                ).map(([artistName, stats]) => ({ ...stats, artistName }));

                setParallelCoordinateDatapoints(perArtist);
            } catch (error) {
                console.error("Error loading CSV:", error);
            }
        };

        dataFromCSV();
    }, []);

    // artist_popularity -> artist followers -> number of tracks -> average track popularity -> track popularity low -> track popularity high

    const hoverTooltipRef = useRef(setHoverTooltip);
    hoverTooltipRef.current = setHoverTooltip;

    function initParallelCoordinate(selected: string | null, onPathHover: (event: MouseEvent | null, d: ParallelCoordinateData | null) => void) {
        let parallelCoordinateContainer = d3.select("#parallel-coordinate-svg");
        const innerW = Math.max(0, size.width - margin.left - margin.right);
        const innerH = Math.max(0, size.height - margin.top - margin.bottom);

        const FOLLOWERS_MAX = 30_000_000;

        const dimensions = (Object.keys(parallelCoordinateDatapoints[0]) as Array<keyof ParallelCoordinateData>).filter(
            (d) => d !== "artistName"
        );

        let xScale: d3.ScalePoint<string> = d3.scalePoint()
            .domain(dimensions)
            .range([0, innerW])
            .padding(0.5);

        const yScales: Partial<Record<keyof ParallelCoordinateData, d3.ScaleContinuousNumeric<number, number>>> = {};
        for (const dimension of dimensions) {
            if (dimension === "artistFollowers") {
                yScales[dimension] = d3.scaleSymlog()
                    .constant(500_000)
                    .domain([0, FOLLOWERS_MAX])
                    .range([innerH, 0])
                    .nice()
                    .clamp(true);
            } else if (dimension === "numberOfTracks") {
                yScales[dimension] = d3.scaleSymlog()
                    .constant(10)
                    .domain([0, d3.max(parallelCoordinateDatapoints, (d) => d.numberOfTracks) ?? 1])
                    .range([innerH, 0])
                    .nice()
                    .clamp(true);
            } else {
                yScales[dimension] = d3.scaleLinear()
                    .domain(d3.extent(parallelCoordinateDatapoints, (d) => +d[dimension]) as [number, number])
                    .range([innerH, 0])
                    .nice();
            }
        }

        let parallelCoordinateG = parallelCoordinateContainer.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const pathOpacity = (d: ParallelCoordinateData) =>
            selected === null ? 0.5 : d.artistName.toLowerCase() === selected.toLowerCase() ? 1 : 0.05;
        const pathStrokeWidth = (d: ParallelCoordinateData) =>
            selected === null ? 0.5 : d.artistName.toLowerCase() === selected.toLowerCase() ? 4 : 0.25;

        const pathLine = d3.line<[number, number]>()
            .x((p) => p[0])
            .y((p) => p[1]);

        const pathsG = parallelCoordinateG.selectAll(".path")
            .data(parallelCoordinateDatapoints)
            .enter()
            .append("path")
            .attr("d", (d) =>
                pathLine(
                    dimensions.map((p) => {
                        const x = xScale(p);
                        const y = yScales[p]?.(d[p]);
                        return [
                            x !== undefined ? +x : 0,
                            y !== undefined && Number.isFinite(y) ? y : 0
                        ];
                    })
                ) ?? ""
            )
            .attr("fill", "none")
            .attr("stroke", "#1DB954")
            .attr("opacity", pathOpacity)
            .attr("stroke-width", pathStrokeWidth)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .style("mix-blend-mode", "soft-light")
            .each(function (this: SVGPathElement, d: ParallelCoordinateData) {
                if (selected !== null && d.artistName.toLowerCase() === selected.toLowerCase()) {
                    const len = this.getTotalLength();
                    d3.select(this)
                        .attr("stroke-dasharray", len)
                        .attr("stroke-dashoffset", len);
                }
            });

        if (selected !== null) {
            const selectedPaths = pathsG.filter((d: ParallelCoordinateData) => d.artistName.toLowerCase() === selected.toLowerCase());
            selectedPaths.transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
                .attr("stroke-dashoffset", 0);
            selectedPaths.raise();
            selectedPaths
                .style("cursor", "pointer")
                .on("mouseover", function (event: MouseEvent, d: ParallelCoordinateData) {
                    onPathHover(event, d);
                })
                .on("mousemove", function (event: MouseEvent, d: ParallelCoordinateData) {
                    onPathHover(event, d);
                })
                .on("mouseout", function () {
                    onPathHover(null, null);
                });
        }

        const axesG = parallelCoordinateG.selectAll(".axis")
            .data(dimensions)
            .enter()
            .append("g")
            .attr("transform", (d) => `translate(${xScale(d)}, 0)`)
            .each(function (d: keyof ParallelCoordinateData) {
                let axis = null;
                if (d === "artistFollowers") {
                    axis = d3.axisLeft(yScales[d] as d3.AxisScale<number>)
                        .ticks(8)
                        .tickFormat((d: number) => {
                            if (d === FOLLOWERS_MAX) return `${d3.format("~s")(FOLLOWERS_MAX)}+`;
                            return d3.format("~s")(d);
                        });
                } else if (d === "numberOfTracks") {
                    axis = d3.axisLeft(yScales[d] as d3.AxisScale<number>)
                        .ticks(6)
                        .tickFormat((d: number) => {
                            return d3.format("~s")(d);
                        });
                } else {
                    axis = d3.axisLeft(yScales[d] as d3.AxisScale<number>);
                }

                d3.select(this).call(axis);
            });

        axesG.selectAll(".tick text")
            .clone(true)
            .lower()
            .attr("fill", "white")
            .attr("stroke", "white")
            .attr("stroke-width", 4)
            .attr("stroke-linejoin", "round")
            .attr("paint-order", "stroke");

        axesG.append("text")
            .style("font-size", "1.1em")
            .style("text-anchor", "middle")
            .attr("y", -20)
            .text(function (d: keyof ParallelCoordinateData) {
                return axesLabelMap[d];
            })
            .attr("fill", "black");

        // Title
        // const titleG = parallelCoordinateG.append("g")
        //     .attr("transform", `translate(${size.width / 2}, -50)`);

        // titleG.append("text")
        //     .style("font-size", "1.5em")
        //     .style("text-anchor", "middle")
        //     .style("dominant-baseline", "middle")
        //     .style("font-weight", 800)
        //     .style("fill", "black")
        //     .text("Artist Statistics");
    }

    useEffect(() => {
        if (isEmpty(parallelCoordinateDatapoints)) return;
        if (size.width === 0 || size.height === 0) return;
        d3.select("#parallel-coordinate-svg").selectAll("*").remove();
        initParallelCoordinate(selectedArtist, (event, d) => {
            if (event === null || d === null) {
                hoverTooltipRef.current(null);
                return;
            }
            const rect = parallelCoordinateRef.current?.getBoundingClientRect();
            const inBottomHalf = rect && event.clientY >= rect.top + rect.height / 2;
            const y = inBottomHalf
                ? event.clientY - TOOLTIP_OFFSET - 160
                : event.clientY + TOOLTIP_OFFSET;
            hoverTooltipRef.current({
                x: event.clientX + TOOLTIP_OFFSET,
                y,
                d,
            });
        });
    }, [parallelCoordinateDatapoints, size, selectedArtist]);

    const tooltipDimensions = hoverTooltip
        ? (Object.keys(hoverTooltip.d) as Array<keyof ParallelCoordinateData>).filter((k) => k !== "artistName")
        : [];

    return (
        <>
            <div ref={parallelCoordinateRef} className="chart-container" style={{ position: "relative" }}>
                <svg id="parallel-coordinate-svg" width="100%" height="100%"></svg>
                {selectedArtist && hoverTooltip && (
                    <div
                        className="parallel-coordinate-tooltip"
                        style={{
                            position: "fixed",
                            left: hoverTooltip.x,
                            top: hoverTooltip.y,
                            pointerEvents: "none",
                            background: "rgba(0,0,0,0.9)",
                            color: "white",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                            zIndex: 1000,
                            minWidth: "200px",
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>{hoverTooltip.d.artistName}</div>
                        {tooltipDimensions.map((dim) => (
                            <div key={dim} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 4 }}>
                                <span style={{ opacity: 0.9 }}>{axesLabelMap[dim]}</span>
                                <span style={{ fontWeight: 500 }}>{formatDimensionValue(dim, hoverTooltip.d[dim] as number)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}