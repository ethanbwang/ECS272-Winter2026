import React from "react"
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { isEmpty } from "lodash";
import { useResizeObserver, useDebounceCallback } from "usehooks-ts";

import { ComponentSize, Margin, ScatterPlotData } from "../types";

export default function ScatterPlot() {
    const [allTracks, setAllTracks] = useState<ScatterPlotData[]>([]);
    const scatterPlotRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
    const margin: Margin = { top: 20, right: 20, bottom: 60, left: 70 };
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200);

    useResizeObserver({ ref: scatterPlotRef as React.RefObject<HTMLDivElement>, onResize });

    // Defaults for now, can set through interactions in next homework
    const [trackPopularityThreshold, setTrackPopularityThreshold] = useState<number>(0);
    const [followerCountThreshold, setFollowerCountThreshold] = useState<number>(999999999);

    useEffect(() => {
        // For reading csv file
        const dataFromCSV = async () => {
            try {
                const spotifyDataCleanData = await d3.csv("../../data/spotify_data_clean.csv", d => {
                    return {
                        artist_name: d.artist_name,
                        artist_followers: d.artist_followers,
                        track_name: d.track_name,
                        track_popularity: d.track_popularity,
                    };
                });

                const trackDataFinalData = await d3.csv("../../data/track_data_final.csv", d => {
                    return {
                        artist_name: d.artist_name,
                        artist_followers: d.artist_followers,
                        track_name: d.track_name,
                        track_popularity: d.track_popularity,
                    };
                });

                const allData = spotifyDataCleanData.concat(trackDataFinalData);

                const candidateTracks = allData
                    .map((d) => {
                        const artistName = d.artist_name?.trim() ?? "";
                        const trackName = d.track_name?.trim() ?? "";
                        const artistFollowers = Number(d.artist_followers);
                        const trackPopularity = Number(d.track_popularity);

                        return {
                            artistName,
                            trackName,
                            artistFollowers,
                            trackPopularity,
                        };
                    })
                    .filter((d) => {
                        if (!d.artistName) return false;
                        if (d.artistName === "TRUE" || d.artistName === "FALSE") return false;
                        if (!Number.isFinite(d.artistFollowers)) return false;
                        if (!Number.isFinite(d.trackPopularity)) return false;
                        return true;
                    });

                const dedupedByArtistTrack = new Map<string, ScatterPlotData>();
                const noTrackNameFallback: ScatterPlotData[] = [];

                for (const row of candidateTracks) {
                    if (!row.trackName) {
                        noTrackNameFallback.push({
                            artistName: row.artistName,
                            artistFollowers: row.artistFollowers,
                            trackPopularity: row.trackPopularity,
                        });
                        continue;
                    }

                    const key = `${row.artistName.toLocaleLowerCase()}||${row.trackName.toLocaleLowerCase()}`;
                    const prev = dedupedByArtistTrack.get(key);
                    if (!prev) {
                        dedupedByArtistTrack.set(key, {
                            artistName: row.artistName,
                            artistFollowers: row.artistFollowers,
                            trackPopularity: row.trackPopularity,
                        });
                        continue;
                    }

                    dedupedByArtistTrack.set(key, {
                        artistName: prev.artistName,
                        artistFollowers: Math.max(prev.artistFollowers, row.artistFollowers),
                        trackPopularity: Math.max(prev.trackPopularity, row.trackPopularity),
                    });
                }

                setAllTracks([...dedupedByArtistTrack.values(), ...noTrackNameFallback]);
            } catch (error) {
                console.error("Error loading CSV:", error);
            }
        };

        dataFromCSV();
    }, []);

    const filteredTracks = allTracks.filter((d) => {
        return d.trackPopularity > trackPopularityThreshold &&
            d.artistFollowers < followerCountThreshold;
    });

    function initScatterPlot() {
        const scatterPlotContainer = d3.select("#scatter-plot-svg");
        const innerW = Math.max(0, size.width - margin.left - margin.right);
        const innerH = Math.max(0, size.height - margin.top - margin.bottom);

        const xMax = d3.max(filteredTracks, (d) => d.artistFollowers) ?? 1;
        const xScale = d3.scaleSymlog()
            .constant(10_000)
            .domain([0, xMax])
            .range([0, innerW])
            .clamp(true)
            .nice();

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(filteredTracks, (d) => d.trackPopularity) ?? 1])
            .range([innerH, 0]);

        const scatterPlotG = scatterPlotContainer.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Points
        scatterPlotG.append("g")
            .selectAll("circle")
            .data(filteredTracks)
            .enter()
            .append("circle")
            .attr("cx", (d) => xScale(d.artistFollowers))
            .attr("cy", (d) => yScale(d.trackPopularity))
            .attr("r", 2)
            .attr("fill", "#1DB954")
            .attr("opacity", 0.55);

        // Axes
        scatterPlotG.append("g")
            .attr("transform", `translate(0, ${innerH})`)
            .call(
                d3.axisBottom(xScale)
                    .ticks(3)
                    .tickFormat((d) => d3.format("~s")(d as number))
            );

        scatterPlotG.append("g")
            .call(d3.axisLeft(yScale).ticks(6));

        // Axis labels
        scatterPlotG.append("text")
            .attr("x", innerW / 2)
            .attr("y", innerH + 40)
            .style("text-anchor", "middle")
            .style("font-size", "1.1em")
            .attr("fill", "black")
            .text("Artist # of Followers");

        scatterPlotG.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerH / 2)
            .attr("y", -40)
            .style("text-anchor", "middle")
            .style("font-size", "1.1em")
            .attr("fill", "black")
            .text("Track Popularity (max 100)");

        // Title
        // const titleG = scatterPlotG.append("g")
        //     .attr("transform", `translate(${innerW / 2}, -40)`);

        // titleG.append("text")
        //     .style("font-size", "1.5em")
        //     .style("text-anchor", "middle")
        //     .style("dominant-baseline", "middle")
        //     .style("font-weight", 800)
        //     .style("fill", "black")
        //     .text("Track Popularity vs Artist Followers");
    }

    useEffect(() => {
        if (isEmpty(filteredTracks)) return;
        if (size.width === 0 || size.height === 0) return;
        d3.select("#scatter-plot-svg").selectAll("*").remove();
        initScatterPlot();
    }, [filteredTracks, size]);

    return (
        <>
            <div ref={scatterPlotRef} className="chart-container">
                <svg id="scatter-plot-svg" width="100%" height="100%"></svg>
            </div>
        </>
    );
}