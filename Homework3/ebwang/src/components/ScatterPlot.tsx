import React from "react"
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { isEmpty } from "lodash";
import { useResizeObserver, useDebounceCallback } from "usehooks-ts";

import { ComponentSize, Margin, ScatterPlotData } from "../types";
import { useSelectedArtist } from "../context/SelectedArtistContext";
import { useRandomTrack } from "../context/RandomTrackContext";

export default function ScatterPlot() {
    const { setSelectedArtist } = useSelectedArtist();
    const { registerRequestRandomTrack } = useRandomTrack();
    const [allTracks, setAllTracks] = useState<ScatterPlotData[]>([]);
    const scatterPlotRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
    const margin: Margin = { top: 20, right: 20, bottom: 60, left: 70 };
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200);

    useResizeObserver({ ref: scatterPlotRef as React.RefObject<HTMLDivElement>, onResize });

    const trackPopularityThreshold = 0;
    const followerCountThreshold = 999999999;

    const [hoveredTrack, setHoveredTrack] = useState<ScatterPlotData | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectedTrack, setSelectedTrack] = useState<ScatterPlotData | null>(null);
    const [selectedTooltipPos, setSelectedTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isZooming, setIsZooming] = useState(false);

    const xScaleRef = useRef<d3.ScaleSymLog<number, number, never>>(null);
    const yScaleRef = useRef<d3.ScaleLinear<number, number, never>>(null);
    const selectedTrackRef = useRef<ScatterPlotData | null>(null);
    selectedTrackRef.current = selectedTrack;

    const fullXDomainRef = useRef<[number, number]>([0, 1]);
    const fullYDomainRef = useRef<[number, number]>([0, 1]);
    const currentXDomainRef = useRef<[number, number]>([0, 1]);
    const currentYDomainRef = useRef<[number, number]>([0, 1]);
    const innerSizeRef = useRef({ w: 0, h: 0 });
    const prevSelectedTrackRef = useRef<ScatterPlotData | null>(null);
    const zoomDuration = 1000;


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
                            trackName: row.trackName,
                            artistFollowers: row.artistFollowers,
                            trackPopularity: row.trackPopularity,
                        });
                        continue;
                    }

                    dedupedByArtistTrack.set(key, {
                        artistName: prev.artistName,
                        trackName: prev.trackName ?? row.trackName,
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

    const filteredTracks = useMemo(
        () =>
            allTracks.filter((d) => {
                return d.trackPopularity > trackPopularityThreshold &&
                    d.artistFollowers < followerCountThreshold;
            }),
        [allTracks, trackPopularityThreshold, followerCountThreshold]
    );

    function calculateTooltipPosition(track: ScatterPlotData) {
        if (!scatterPlotRef.current || !xScaleRef.current || !yScaleRef.current) return null;

        const svgX = xScaleRef.current(track.artistFollowers);
        const svgY = yScaleRef.current(track.trackPopularity);

        const rect = scatterPlotRef.current.getBoundingClientRect();

        return {
            x: rect.left + margin.left + svgX,
            y: rect.top + margin.top + svgY,
        };
    };

    function getZoomedDomain(
        track: ScatterPlotData,
        xMax: number,
        yMax: number
    ): { xDomain: [number, number]; yDomain: [number, number] } {
        const zoomPaddingX = 2.5;
        const zoomPaddingY = 12;
        const xCenter = track.artistFollowers;
        const yCenter = track.trackPopularity;
        return {
            xDomain: [
                Math.max(0, xCenter / zoomPaddingX),
                Math.min(xMax, xCenter * zoomPaddingX),
            ],
            yDomain: [
                Math.max(0, yCenter - zoomPaddingY),
                Math.min(yMax, yCenter + zoomPaddingY),
            ],
        };
    }

    function isInDomain(
        d: ScatterPlotData,
        xDomain: [number, number],
        yDomain: [number, number]
    ): boolean {
        return (
            d.artistFollowers >= xDomain[0] &&
            d.artistFollowers <= xDomain[1] &&
            d.trackPopularity >= yDomain[0] &&
            d.trackPopularity <= yDomain[1]
        );
    }

    /**
     * Pan domain: same extent as current, with the selected point at the chart's visual center
     * (accounts for left/right and top/bottom margins so the point is centered in the container).
     */
    function getPanDomain(
        track: ScatterPlotData,
        currentXDomain: [number, number],
        currentYDomain: [number, number],
        xMax: number,
        yMax: number,
        innerW: number,
        innerH: number
    ): { xDomain: [number, number]; yDomain: [number, number] } {
        const xCenter = track.artistFollowers;
        const yCenter = track.trackPopularity;
        const yHeight = currentYDomain[1] - currentYDomain[0];

        // Visual center of the chart container
        const targetCenterX = (innerW + margin.right - margin.left) / 2;
        const targetCenterY = (innerH + margin.bottom - margin.top) / 2;

        // Y is linear, place point at targetCenterY; keep same extent, then clamp
        let y0 = yCenter - yHeight * (innerH - targetCenterY) / innerH;
        let y1 = y0 + yHeight;
        if (y0 < 0) {
            y0 = 0;
            y1 = Math.min(yMax, yHeight);
        }
        if (y1 > yMax) {
            y1 = yMax;
            y0 = Math.max(0, yMax - yHeight);
        }
        const yDomain: [number, number] = [y0, y1];

        // X is symlog, find domain [x0, x1] so xCenter maps to targetCenterX, keeping same zoom ratio
        const [x0cur, x1cur] = currentXDomain;
        const ratio = x1cur > 0 && x0cur >= 0 ? x1cur / Math.max(x0cur, 1e-9) : 2.5;
        const symlogConstant = 100_000;
        const scale = () => d3.scaleSymlog().constant(symlogConstant).range([0, innerW]);
        let x0 = xCenter / Math.sqrt(ratio);
        let x1 = x0 * ratio;
        for (let i = 0; i < 20; i++) {
            const s = scale().domain([x0, x1]).clamp(true);
            const inv = s.invert(targetCenterX);
            const err = inv - xCenter;
            if (Math.abs(err) < 1e-6 * xCenter) break;
            x0 = Math.max(1e-9, x0 - err * 0.5);
            x1 = x0 * ratio;
        }
        x0 = Math.max(0, x0);
        x1 = Math.min(xMax, x1);
        if (x1 > xMax) {
            x1 = xMax;
            x0 = Math.max(0, (xCenter * xCenter) / xMax);
        }
        const xDomain: [number, number] = [x0, x1];
        return { xDomain, yDomain };
    }

    function initScatterPlot() {
        const scatterPlotContainer = d3.select("#scatter-plot-svg");
        const innerW = Math.max(0, size.width - margin.left - margin.right);
        const innerH = Math.max(0, size.height - margin.top - margin.bottom);
        innerSizeRef.current = { w: innerW, h: innerH };

        const xMax = d3.max(filteredTracks, (d) => d.artistFollowers) ?? 1;
        const yMax = d3.max(filteredTracks, (d) => d.trackPopularity) ?? 1;

        const xDomain: [number, number] = [0, xMax];
        const yDomain: [number, number] = [0, yMax];
        fullXDomainRef.current = xDomain;
        fullYDomainRef.current = yDomain;
        currentXDomainRef.current = xDomain;
        currentYDomainRef.current = yDomain;

        const xScale = d3.scaleSymlog()
            .constant(100_000)
            .domain(xDomain)
            .range([0, innerW])
            .clamp(true)
            .nice();

        const xTickSteps = [
            0, 1e4, 2.5e4, 5e4, 1e5, 2e5, 3e5, 5e5,
            1e6, 2e6, 3e6, 5e6, 1e7, 2e7, 5e7, 1e8, 160_000_000
        ];
        const xTickValues = xTickSteps.filter((t) => t >= xDomain[0] && t <= xDomain[1]);

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([innerH, 0]);

        xScaleRef.current = xScale;
        yScaleRef.current = yScale;

        const scatterPlotG = scatterPlotContainer.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        scatterPlotContainer.append("defs").append("clipPath")
            .attr("id", "scatter-plot-clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", innerW)
            .attr("height", innerH);

        const pointsG = scatterPlotG.append("g")
            .attr("class", "scatter-points")
            .attr("clip-path", "url(#scatter-plot-clip)");

        const circles = pointsG
            .selectAll("circle")
            .data(filteredTracks)
            .enter()
            .append("circle")
            .attr("cx", (d) => xScale(d.artistFollowers))
            .attr("cy", (d) => yScale(d.trackPopularity))
            .attr("r", (d) => (d === hoveredTrack || d === selectedTrack ? 4 : 2))
            .attr("fill", (d) => (d === hoveredTrack || d === selectedTrack ? "black" : "#1DB954"))
            .attr("opacity", (d) => {
                const inView = isInDomain(d, xDomain, yDomain);
                if (!inView) return 0;
                return d === hoveredTrack || d === selectedTrack ? 1 : 0.55;
            })
            .style("cursor", "pointer")
            .on("mouseenter", function (event, d) {
                setHoveredTrack(d);
                const pos = calculateTooltipPosition(d);
                if (pos) setTooltipPos(pos);
                else setTooltipPos({ x: event.clientX, y: event.clientY });
            })
            .on("mouseout", function () {
                setHoveredTrack(null);
            })
            .on("mousedown", function (event, d: ScatterPlotData) {
                if (d === selectedTrackRef.current) {
                    setSelectedTrack(null);
                    setSelectedArtist(null);
                } else {
                    setSelectedTrack(d);
                    setSelectedArtist(d.artistName);
                    const pos = calculateTooltipPosition(d);
                    if (pos) setSelectedTooltipPos(pos);
                    else setSelectedTooltipPos({ x: event.clientX, y: event.clientY });
                }
            });

        circles.filter((d) => d === hoveredTrack || d === selectedTrack).raise();

        if (selectedTrack) {
            const tooltipPos = calculateTooltipPosition(selectedTrack);
            if (tooltipPos) {
                setSelectedTooltipPos(tooltipPos);
            }
        }

        // Axes
        const xAxis = d3.axisBottom(xScale).tickFormat((d) => d3.format("~s")(d as number));
        if (xTickValues.length > 0) {
            xAxis.tickValues(xTickValues);
        }
        scatterPlotG.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${innerH})`)
            .call(xAxis);

        scatterPlotG.append("g")
            .attr("class", "y-axis")
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

    // Gradual zoom when selection changes
    // When switching from one point to another, zoom out then zoom in if point
    // is not on-screen, otherwise pan to new point
    useEffect(() => {
        if (isEmpty(filteredTracks)) return;
        if (size.width === 0 || size.height === 0) return;
        const xMax = d3.max(filteredTracks, (d) => d.artistFollowers) ?? 1;
        const yMax = d3.max(filteredTracks, (d) => d.trackPopularity) ?? 1;
        const { w: innerW, h: innerH } = innerSizeRef.current;
        if (innerW <= 0 || innerH <= 0) return;

        const xScale = xScaleRef.current;
        const yScale = yScaleRef.current;
        if (!xScale || !yScale) return;

        const fullDomain = { xDomain: fullXDomainRef.current, yDomain: fullYDomainRef.current };
        const zoomedTarget = selectedTrack
            ? getZoomedDomain(selectedTrack, xMax, yMax)
            : fullDomain;

        const isSwitchingPoints =
            selectedTrack != null &&
            prevSelectedTrackRef.current != null &&
            prevSelectedTrackRef.current !== selectedTrack;

        const currentXD = currentXDomainRef.current;
        const currentYD = currentYDomainRef.current;
        const newPointInView =
            isSwitchingPoints &&
            selectedTrack != null &&
            isInDomain(selectedTrack, currentXD, currentYD);

        const finalTarget = selectedTrack
            ? newPointInView
                ? getPanDomain(selectedTrack, currentXD, currentYD, xMax, yMax, innerW, innerH)
                : zoomedTarget
            : fullDomain;

        setIsZooming(true);

        function runTransition(
            toDomain: { xDomain: [number, number]; yDomain: [number, number] },
            onComplete?: () => void
        ) {
            const startX = currentXDomainRef.current;
            const startY = currentYDomainRef.current;
            const xInterp = d3.interpolate(startX, toDomain.xDomain);
            const yInterp = d3.interpolate(startY, toDomain.yDomain);

            const pointsG = d3.select("#scatter-plot-svg").select<SVGGElement>(".scatter-points");
            const circles = pointsG.selectAll<SVGCircleElement, ScatterPlotData>("circle");
            const xAxisG = d3.select("#scatter-plot-svg").select<SVGGElement>(".x-axis");
            const yAxisG = d3.select("#scatter-plot-svg").select<SVGGElement>(".y-axis");
            if (circles.empty()) {
                onComplete?.();
                return null;
            }

            const xTickSteps = [
                0, 1e4, 2.5e4, 5e4, 1e5, 2e5, 3e5, 5e5,
                1e6, 2e6, 3e6, 5e6, 1e7, 2e7, 5e7, 1e8, 160_000_000
            ];

            const t = d3.transition().duration(zoomDuration).ease(d3.easeCubicInOut);
            t.tween("zoom", function () {
                return (s: number) => {
                    const xD = xInterp(s) as [number, number];
                    const yD = yInterp(s) as [number, number];
                    currentXDomainRef.current = xD;
                    currentYDomainRef.current = yD;

                    const xScaleNew = d3.scaleSymlog()
                        .constant(100_000)
                        .domain(xD)
                        .range([0, innerW])
                        .clamp(true)
                        .nice();
                    const yScaleNew = d3.scaleLinear().domain(yD).range([innerH, 0]);
                    xScaleRef.current = xScaleNew;
                    yScaleRef.current = yScaleNew;

                    circles
                        .attr("cx", (d) => xScaleNew(d.artistFollowers))
                        .attr("cy", (d) => yScaleNew(d.trackPopularity))
                        .attr("opacity", (d) => {
                            const inView = isInDomain(d, xD, yD);
                            if (!inView) return 0;
                            return d === hoveredTrack || d === selectedTrackRef.current ? 1 : 0.55;
                        });

                    const xTickValues = xTickSteps.filter((tick) => tick >= xD[0] && tick <= xD[1]);
                    const xAxis = d3.axisBottom(xScaleNew).tickFormat((d) => d3.format("~s")(d as number));
                    if (xTickValues.length > 0) xAxis.tickValues(xTickValues);
                    xAxisG.call(xAxis);
                    yAxisG.call(d3.axisLeft(yScaleNew).ticks(6));
                };
            });
            if (onComplete) {
                t.on("end", onComplete);
            }
            return t;
        }

        const onZoomComplete = () => {
            const track = selectedTrackRef.current;
            if (track) {
                const pos = calculateTooltipPosition(track);
                if (pos) setSelectedTooltipPos(pos);
            }
            setIsZooming(false);
        };

        if (isSwitchingPoints && !newPointInView) {
            const t1 = runTransition(fullDomain);
            if (t1) t1.on("end", () => runTransition(zoomedTarget, onZoomComplete));
            else setIsZooming(false);
        } else {
            const t = runTransition(finalTarget, onZoomComplete);
            if (!t) setIsZooming(false);
        }

        prevSelectedTrackRef.current = selectedTrack;
    }, [selectedTrack, filteredTracks]);

    // Update circle styling when hover/selection changes
    useEffect(() => {
        if (isEmpty(filteredTracks)) return;
        const circles = d3.select("#scatter-plot-svg").select(".scatter-points")?.selectAll<SVGCircleElement, ScatterPlotData>("circle");
        if (circles.empty()) return;
        const xD = currentXDomainRef.current;
        const yD = currentYDomainRef.current;
        circles
            .attr("r", (d) => (d === hoveredTrack || d === selectedTrack ? 4 : 2))
            .attr("fill", (d) => (d === hoveredTrack || d === selectedTrack ? "black" : "#1DB954"))
            .attr("opacity", (d) => {
                if (!isInDomain(d, xD, yD)) return 0;
                return d === hoveredTrack || d === selectedTrack ? 1 : 0.55;
            });
        circles.filter((d) => d === hoveredTrack || d === selectedTrack).raise();
    }, [filteredTracks, hoveredTrack, selectedTrack]);

    // Random track handler for picking a random track
    useEffect(() => {
        if (isEmpty(filteredTracks)) return;
        registerRequestRandomTrack(() => {
            const idx = Math.floor(Math.random() * filteredTracks.length);
            const track = filteredTracks[idx];
            setSelectedTrack(track);
            setSelectedArtist(track.artistName);
            const pos = calculateTooltipPosition(track);
            if (pos) setSelectedTooltipPos(pos);
        });
    }, [filteredTracks, registerRequestRandomTrack]);

    return (
        <>
            <div ref={scatterPlotRef} className="chart-container" style={{ position: "relative" }}>
                <svg id="scatter-plot-svg" width="100%" height="100%"></svg>
                {selectedTrack && !isZooming && (
                    <div
                        className="scatter-tooltip scatter-tooltip-selected"
                        style={{
                            position: "fixed",
                            left: selectedTooltipPos.x - 24,
                            top: selectedTooltipPos.y + 12,
                            pointerEvents: "none",
                            background: "rgba(0,0,0,0.85)",
                            color: "white",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            zIndex: 1000,
                            maxWidth: "280px",
                        }}
                    >
                        <div style={{ fontWeight: 600 }}>{selectedTrack.artistName}</div>
                        <div style={{ marginTop: 4, opacity: 0.95 }}>
                            {selectedTrack.trackName ?? "—"}
                        </div>
                    </div>
                )}
                {hoveredTrack && hoveredTrack !== selectedTrack && (
                    <div
                        className="scatter-tooltip scatter-tooltip-hover"
                        style={{
                            position: "fixed",
                            left: tooltipPos.x - 24,
                            top: tooltipPos.y + 12,
                            pointerEvents: "none",
                            background: "rgba(0,0,0,0.85)",
                            color: "white",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            zIndex: 1001,
                            maxWidth: "280px",
                        }}
                    >
                        <div style={{ fontWeight: 600 }}>{hoveredTrack.artistName}</div>
                        <div style={{ marginTop: 4, opacity: 0.95 }}>
                            {hoveredTrack.trackName ?? "—"}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}