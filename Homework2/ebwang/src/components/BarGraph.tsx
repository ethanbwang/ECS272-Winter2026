import React from "react"
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { isEmpty } from "lodash";
import { useResizeObserver, useDebounceCallback } from "usehooks-ts";

import { ComponentSize, Margin, BarGraphData } from "../types";

export default function BarGraph({ setBarTitle }: { setBarTitle?: React.Dispatch<React.SetStateAction<string>> }) {
    const [allTracks, setAllTracks] = useState<BarGraphData[]>([]);
    const barGraphRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200);

    // Defaults for now, can be set through interactions in next homework
    const [selectedArtist, setSelectedArtist] = useState<string>("Taylor Swift");
    const [numTracksToShow, setNumTracksToShow] = useState<number>(10);

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

        // Sort by popularity
        const tracks = [...bestByTrackName.values()]
            .sort((a, b) => d3.descending(a.trackPopularity, b.trackPopularity));

        // Set the number of tracks to show
        const n = Math.max(1, Math.floor(numTracksToShow));
        setNumTracksToShow(n);

        // Bar graph title would be dynamically set here
        setBarTitle?.(`Top ${n} Tracks for ${selectedArtist}`);

        return tracks.slice(0, n);
    }, [allTracks, selectedArtist, numTracksToShow]);

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
        const left = Math.ceil(maxLabelWidth * 5 + 10);
        return Math.max(MIN_LEFT, Math.min(MAX_LEFT, left));
    }, [topTracksForArtist]);

    const margin: Margin = useMemo(
        () => ({ top: 40, right: 20, bottom: 60, left: dynamicLeftMargin }),
        [dynamicLeftMargin]
    );

    function initBarGraph() {
        const container = d3.select("#bar-graph-svg");
        const innerW = Math.max(0, size.width - margin.left - margin.right);
        const innerH = Math.max(0, size.height - margin.top - margin.bottom);

        // Scales
        const yScale = d3.scaleBand<string>()
            .domain(topTracksForArtist.map((d) => d.trackName))
            .range([0, innerH])
            .padding(0.2);

        // const xMax = d3.max(topTracksForArtist, (d) => d.trackPopularity) ?? 1;
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, innerW])
            .nice();

        const barGraphG = container.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Bars
        barGraphG.append("g")
            .selectAll("rect")
            .data(topTracksForArtist, (d: any) => (d as BarGraphData).trackName)
            .enter()
            .append("rect")
            .attr("x", 0)
            .attr("y", (d) => yScale(d.trackName) ?? 0)
            .attr("width", (d) => xScale(d.trackPopularity))
            .attr("height", yScale.bandwidth())
            .attr("fill", "#1DB954")
            .attr("opacity", 0.75);

        // X axis
        barGraphG.append("g")
            .attr("transform", `translate(0, ${innerH})`)
            .call(d3.axisBottom(xScale).ticks(6));

        // Y axis
        const truncate = (s: string) => (s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s);
        const yAxisG = barGraphG.append("g")
            .call(d3.axisLeft(yScale).tickFormat(truncate));

        // X axis label
        barGraphG.append("text")
            .attr("x", innerW / 2)
            .attr("y", innerH + 45)
            .style("text-anchor", "middle")
            .style("font-size", "1.1em")
            .attr("fill", "black")
            .text("Track Popularity (max 100)");

        // Y axis label
        // Placed above the ticks in case track names get long
        const tickTextNodes = yAxisG.selectAll<SVGTextElement, unknown>(".tick text").nodes();
        const firstTickText = tickTextNodes[0] ?? null;
        const tickTextAnchor = firstTickText ? d3.select(firstTickText).style("text-anchor") : "end";
        const tickX = firstTickText ? Number(firstTickText.getAttribute("x") ?? 0) : 0;

        // Align with the tick labels (same x + same text-anchor)
        const labelX = tickX;
        const labelY = -12;

        barGraphG.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .style("text-anchor", tickTextAnchor || "end")
            .style("font-size", "1.1em")
            .attr("fill", "black")
            .text("Track Name");

        // Title
        // const titleG = barGraphG.append("g")
        //     .attr("transform", `translate(${innerW / 2}, -40)`);

        // titleG.append("text")
        //     .style("font-size", "1.5em")
        //     .style("text-anchor", "middle")
        //     .style("dominant-baseline", "middle")
        //     .style("font-weight", 800)
        //     .style("fill", "black")
        //     .text(`Top ${numTracksToShow} Tracks for ${selectedArtist}`);
    }

    useEffect(() => {
        if (isEmpty(topTracksForArtist)) return;
        if (size.width === 0 || size.height === 0) return;
        d3.select("#bar-graph-svg").selectAll("*").remove();
        initBarGraph();
    }, [topTracksForArtist, size, selectedArtist, margin.left]);

    return (
        <>
            <div ref={barGraphRef} className="chart-container">
                <svg id="bar-graph-svg" width="100%" height="100%"></svg>
            </div>
        </>
    );
}