import React from "react"
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { isEmpty } from "lodash";
import { useResizeObserver, useDebounceCallback } from "usehooks-ts";

import { ComponentSize, Margin, BarGraphData } from "../types";
import { useSelectedArtist } from "../context/SelectedArtistContext";
import { useNumTracks } from "../context/NumTracksContext";

export default function BarGraph() {
    const [allTracks, setAllTracks] = useState<BarGraphData[]>([]);
    const barGraphRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200);

    // Defaults for now, can be set through interactions in next homework
    const { selectedArtist } = useSelectedArtist();
    const { numTracks, setNumTracks } = useNumTracks();

    useResizeObserver({ ref: barGraphRef as React.RefObject<HTMLDivElement>, onResize });

    useEffect(() => {
        // For reading csv file
        const dataFromCSV = async () => {
            try {
                const spotifyDataCleanData = await d3.csv("../../data/spotify_data_clean.csv", d => {
                    return {
                        artist_name: d.artist_name,
                        track_name: d.track_name,
                        track_popularity: d.track_popularity,
                    };
                });

                const trackDataFinalData = await d3.csv("../../data/track_data_final.csv", d => {
                    return {
                        artist_name: d.artist_name,
                        track_name: d.track_name,
                        track_popularity: d.track_popularity,
                    };
                });

                const allData = spotifyDataCleanData.concat(trackDataFinalData);

                const cleanedTracks: BarGraphData[] = allData
                    .map((d) => {
                        // Clean data and map to proper types
                        const artistName = d.artist_name?.trim() ?? "";
                        const trackName = d.track_name?.trim() ?? "";
                        const trackPopularity = Number(d.track_popularity);

                        return {
                            artistName,
                            trackName,
                            trackPopularity,
                        };
                    })
                    .filter((d) => {
                        // Remove bad data
                        if (!d.artistName) return false;
                        if (d.artistName === "TRUE" || d.artistName === "FALSE") return false;
                        if (!d.trackName) return false;
                        if (!Number.isFinite(d.trackPopularity)) return false;
                        return true;
                    });

                setAllTracks(cleanedTracks);
            } catch (error) {
                console.error("Error loading CSV:", error);
            }
        };

        dataFromCSV();
    }, []);

    const topTracksForArtist = useMemo(() => {
        if (!selectedArtist) return [];
        const bestByTrackName = new Map<string, BarGraphData>();
        for (const row of allTracks) {
            if (row.artistName.toLowerCase() !== selectedArtist.toLowerCase()) continue;
            const key = row.trackName.trim().toLowerCase();
            // Take the highest popularity track for each track name if there
            // are duplicates.
            // This also prevents duplicate tracks from being
            // passed to the graphing code.
            const prev = bestByTrackName.get(key);
            if (!prev || row.trackPopularity > prev.trackPopularity) {
                bestByTrackName.set(key, row);
            }
        }

        // Sort by popularity; show up to 10 tracks, or all if artist has fewer
        const tracks = [...bestByTrackName.values()]
            .sort((a, b) => d3.descending(a.trackPopularity, b.trackPopularity));

        return tracks.slice(0, 10);
    }, [allTracks, selectedArtist]);

    useEffect(() => {
        setNumTracks(topTracksForArtist.length);
    }, [topTracksForArtist, setNumTracks]);

    // Maximum number of characters for a track name
    const maxChars = 22;

    // Dynamically set the left margin depending on the length of the longest
    // track name
    // Note: no longer useful because I'm limiting track names to 22 characters
    const dynamicLeftMargin = useMemo(() => {
        const MIN_LEFT = 110;
        const MAX_LEFT = 520;

        if (isEmpty(topTracksForArtist)) return MIN_LEFT;

        // Remove Math.min and maxChars to use the max track name length
        const maxLabelWidth = Math.min(d3.max(topTracksForArtist, (d) => d.trackName.length) ?? 0, maxChars);
        const left = Math.ceil(maxLabelWidth * 6 + 20);
        return Math.max(MIN_LEFT, Math.min(MAX_LEFT, left));
    }, [topTracksForArtist]);

    const margin: Margin = useMemo(
        () => ({ top: 40, right: 20, bottom: 60, left: dynamicLeftMargin }),
        [dynamicLeftMargin]
    );

    const truncate = (s: string) => (s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s);

    useEffect(() => {
        if (size.width === 0 || size.height === 0) return;

        const container = d3.select("#bar-graph-svg");
        const innerW = Math.max(0, size.width - margin.left - margin.right);
        const innerH = Math.max(0, size.height - margin.top - margin.bottom);

        const yScale = d3.scaleBand<string>()
            .domain(topTracksForArtist.map((d) => d.trackName))
            .range([0, innerH])
            .padding(0.2);

        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, innerW])
            .nice();

        let mainG = container.select("g.bar-graph-main");
        if (mainG.empty()) {
            mainG = container.append("g").attr("class", "bar-graph-main");
        }
        mainG.attr("transform", `translate(${margin.left}, ${margin.top})`);

        let barsG = mainG.select("g.bars");
        if (barsG.empty()) {
            barsG = mainG.append("g").attr("class", "bars");
        }
        const keyFn = (d: BarGraphData) => d.trackName;
        const barDuration = 1000;
        barsG.selectAll<SVGRectElement, BarGraphData>("rect")
            .data(topTracksForArtist, keyFn)
            .join(
                (enter) =>
                    enter
                        .append("rect")
                        .attr("x", 0)
                        .attr("y", (d) => yScale(d.trackName) ?? 0)
                        .attr("width", 0)
                        .attr("height", yScale.bandwidth())
                        .attr("fill", "#1DB954")
                        .attr("opacity", 0.75)
                        .transition()
                        .delay(barDuration)
                        .duration(barDuration)
                        .ease(d3.easeCubicOut)
                        .attr("width", (d) => xScale(d.trackPopularity)),
                (update) =>
                    update
                        .transition()
                        .duration(barDuration)
                        .ease(d3.easeCubicOut)
                        .attr("y", (d) => yScale(d.trackName) ?? 0)
                        .attr("width", (d) => xScale(d.trackPopularity))
                        .attr("height", yScale.bandwidth()),
                (exit) =>
                    exit
                        .transition()
                        .duration(barDuration)
                        .ease(d3.easeCubicIn)
                        .attr("width", 0)
                        .remove()
            );

        let xAxisG = mainG.select("g.x-axis");
        if (xAxisG.empty()) {
            xAxisG = mainG.append("g").attr("class", "x-axis");
        }
        xAxisG.attr("transform", `translate(0, ${innerH})`).call(d3.axisBottom(xScale).ticks(6) as (sel: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>) => void);

        let yAxisG = mainG.select("g.y-axis");
        if (yAxisG.empty()) {
            yAxisG = mainG.append("g").attr("class", "y-axis");
        }
        yAxisG.call(d3.axisLeft(yScale).tickFormat(truncate) as (sel: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>) => void);

        // Tooltip to display full track name when hovering over y-axis tick text
        yAxisG.selectAll(".tick").each(function (this: SVGGElement) {
            const fullTrackName = d3.select(this).datum() as string;
            const textEl = d3.select(this).select("text");
            textEl.selectAll("title").remove();
            textEl.append("title").text(fullTrackName);
        });

        // X axis label
        let xLabel = mainG.select("text.x-label");
        if (xLabel.empty()) {
            xLabel = mainG.append("text").attr("class", "x-label");
            xLabel.style("text-anchor", "middle").style("font-size", "1.1em").attr("fill", "black");
        }
        xLabel.attr("x", innerW / 2).attr("y", innerH + 45).text("Track Popularity (max 100)");

        // Y axis label (position from first tick)
        const tickTextNodes = yAxisG.selectAll<SVGTextElement, unknown>(".tick text").nodes();
        const firstTickText = tickTextNodes[0] ?? null;
        const tickTextAnchor = firstTickText ? d3.select(firstTickText).style("text-anchor") : "end";
        const tickX = firstTickText ? Number(firstTickText.getAttribute("x") ?? 0) : 0;
        let yLabel = mainG.select("text.y-label");
        if (yLabel.empty()) {
            yLabel = mainG.append("text").attr("class", "y-label");
            yLabel.style("font-size", "1.1em").attr("fill", "black");
        }
        yLabel.attr("x", tickX).attr("y", -12).style("text-anchor", tickTextAnchor || "end").text("Track Name");
    }, [topTracksForArtist, size, margin]);

    return (
        <>
            <div ref={barGraphRef} className="chart-container">
                <svg id="bar-graph-svg" width="100%" height="100%"></svg>
            </div>
        </>
    );
}