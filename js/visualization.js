/**
 * SVG-based chromosome visualization engine.
 * Draws ideogram-style chromosomes with centromeres, gene markers, and labels.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const VIS_CONFIG = {
    karyotype: {
        chrWidth: 26,
        maxChrHeight: 340,
        centromereWidth: 14,
        cornerRadius: 10,
        pArmColor: "#5b8fb9",
        qArmColor: "#4a7fa8",
        centromereColor: "#1e293b",
        outlineColor: "#475569",
        outlineWidth: 1.5,
    },
    detail: {
        chrWidth: 50,
        maxChrHeight: 320,
        centromereWidth: 28,
        cornerRadius: 16,
        pArmColor: "#5b8fb9",
        qArmColor: "#4a7fa8",
        centromereColor: "#1e293b",
        outlineColor: "#475569",
        outlineWidth: 2,
    },
    marker: {
        color: "#ef4444",
        glowColor: "rgba(239, 68, 68, 0.5)",
        triangleSize: 7,
        lineWidth: 2,
    }
};

/**
 * Create an SVG element with attributes.
 */
function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

/**
 * Draw a single chromosome ideogram as an SVG.
 * Returns the SVG element.
 */
function drawChromosome(chrId, config, geneMarkers = []) {
    const chrData = CHROMOSOMES[chrId];
    if (!chrData) return null;

    const scale = config.maxChrHeight / MAX_CHR_SIZE;
    const totalHeight = chrData.size * scale;
    const centStart = chrData.centromereStart * scale;
    const centEnd = chrData.centromereEnd * scale;
    const centMid = (centStart + centEnd) / 2;
    const w = config.chrWidth;
    const cw = config.centromereWidth;
    const r = config.cornerRadius;
    const markerExtend = 30;

    const svgWidth = w + markerExtend * 2 + 20;
    const svgHeight = totalHeight + 20;

    const svg = svgEl("svg", {
        width: svgWidth,
        height: svgHeight,
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
        class: "chromosome-svg"
    });

    // Defs for gradients and filters
    const defs = svgEl("defs");

    // Chromosome gradient
    const grad = svgEl("linearGradient", { id: `chr-grad-${chrId}`, x1: "0", y1: "0", x2: "1", y2: "0" });
    const stop1 = svgEl("stop", { offset: "0%", "stop-color": config.pArmColor, "stop-opacity": "0.8" });
    const stop2 = svgEl("stop", { offset: "50%", "stop-color": config.pArmColor, "stop-opacity": "1" });
    const stop3 = svgEl("stop", { offset: "100%", "stop-color": config.pArmColor, "stop-opacity": "0.8" });
    grad.append(stop1, stop2, stop3);
    defs.appendChild(grad);

    // Glow filter for markers
    const filter = svgEl("filter", { id: `glow-${chrId}`, x: "-50%", y: "-50%", width: "200%", height: "200%" });
    const feGauss = svgEl("feGaussianBlur", { stdDeviation: "3", result: "coloredBlur" });
    const feMerge = svgEl("feMerge");
    const feMergeNode1 = svgEl("feMergeNode", { in: "coloredBlur" });
    const feMergeNode2 = svgEl("feMergeNode", { in: "SourceGraphic" });
    feMerge.append(feMergeNode1, feMergeNode2);
    filter.append(feGauss, feMerge);
    defs.appendChild(filter);

    svg.appendChild(defs);

    const offsetX = markerExtend + 10;
    const offsetY = 10;

    // Draw chromosome body using path for rounded shape with centromere pinch
    const halfW = w / 2;
    const halfCW = cw / 2;
    const cx = offsetX + halfW;

    // Build the chromosome path
    // p-arm (top) -> centromere pinch -> q-arm (bottom)
    const path = buildChromosomePath(cx, offsetY, halfW, halfCW, totalHeight, centStart, centEnd, r);

    const chrPath = svgEl("path", {
        d: path,
        fill: `url(#chr-grad-${chrId})`,
        stroke: config.outlineColor,
        "stroke-width": config.outlineWidth,
    });
    svg.appendChild(chrPath);

    // Centromere band
    const centBand = svgEl("ellipse", {
        cx: cx,
        cy: offsetY + centMid,
        rx: halfCW - 1,
        ry: (centEnd - centStart) * 0.3,
        fill: config.centromereColor,
        opacity: "0.6"
    });
    svg.appendChild(centBand);

    // Draw banding pattern (simplified)
    drawBandingPattern(svg, cx, offsetY, halfW, totalHeight, centStart, centEnd, chrId, config);

    // Gene markers
    geneMarkers.forEach(marker => {
        drawGeneMarker(svg, marker, chrData, scale, cx, offsetX, halfW, offsetY, markerExtend, config);
    });

    return svg;
}

/**
 * Build the chromosome outline path with centromere pinch.
 */
function buildChromosomePath(cx, oy, halfW, halfCW, totalH, centS, centE, r) {
    const top = oy;
    const bot = oy + totalH;
    const left = cx - halfW;
    const right = cx + halfW;
    const centLeft = cx - halfCW;
    const centRight = cx + halfCW;
    const centMid = (centS + centE) / 2 + oy;
    const pinchTop = centS + oy;
    const pinchBot = centE + oy;

    // Clamp corner radius
    const rr = Math.min(r, halfW, totalH * 0.05);

    return [
        // Start at top-left after corner
        `M ${left + rr} ${top}`,
        // Top edge
        `L ${right - rr} ${top}`,
        // Top-right corner
        `Q ${right} ${top} ${right} ${top + rr}`,
        // Right side down to centromere
        `L ${right} ${pinchTop - 5}`,
        // Pinch in to centromere
        `Q ${right} ${centMid} ${centRight} ${centMid}`,
        // Pinch back out
        `Q ${right} ${centMid} ${right} ${pinchBot + 5}`,
        // Right side down to bottom
        `L ${right} ${bot - rr}`,
        // Bottom-right corner
        `Q ${right} ${bot} ${right - rr} ${bot}`,
        // Bottom edge
        `L ${left + rr} ${bot}`,
        // Bottom-left corner
        `Q ${left} ${bot} ${left} ${bot - rr}`,
        // Left side up to centromere
        `L ${left} ${pinchBot + 5}`,
        // Pinch in
        `Q ${left} ${centMid} ${centLeft} ${centMid}`,
        // Pinch back out
        `Q ${left} ${centMid} ${left} ${pinchTop - 5}`,
        // Left side up to top
        `L ${left} ${top + rr}`,
        // Top-left corner
        `Q ${left} ${top} ${left + rr} ${top}`,
        `Z`
    ].join(" ");
}

/**
 * Draw simplified banding pattern on chromosome.
 */
function drawBandingPattern(svg, cx, oy, halfW, totalH, centS, centE, chrId, config) {
    // Generate deterministic pseudo-bands based on chromosome ID
    const seed = chrId.charCodeAt(0) * 137;
    const bandCount = 8 + (seed % 6);
    const bandHeight = totalH / bandCount;

    for (let i = 0; i < bandCount; i++) {
        const y = oy + i * bandHeight;
        const h = bandHeight * 0.4;
        const midY = y + bandHeight / 2;

        // Skip centromere region
        if (midY > oy + centS - 5 && midY < oy + centE + 5) continue;

        // Vary opacity based on position for visual interest
        const opacity = 0.05 + (((seed + i * 43) % 10) / 10) * 0.12;

        // Calculate width at this position (account for centromere pinch)
        let bandW = halfW;
        const relY = midY - oy;
        if (relY > centS && relY < centE) {
            const centMid = (centS + centE) / 2;
            const dist = Math.abs(relY - centMid) / ((centE - centS) / 2);
            bandW = halfW * (0.5 + dist * 0.5);
        }

        const band = svgEl("rect", {
            x: cx - bandW + 2,
            y: y + bandHeight * 0.3,
            width: (bandW - 2) * 2,
            height: h,
            fill: (i % 2 === 0) ? "#1e293b" : "#334155",
            opacity: opacity,
            rx: 1
        });
        svg.appendChild(band);
    }
}

/**
 * Draw a gene marker on the chromosome.
 */
function drawGeneMarker(svg, marker, chrData, scale, cx, offsetX, halfW, offsetY, markerExtend, config) {
    const pos = ((marker.start + marker.end) / 2) * scale + offsetY;
    const mc = VIS_CONFIG.marker;

    // Marker line extending from chromosome
    const lineGroup = svgEl("g", { class: "gene-marker-line" });

    // Left line
    const line = svgEl("line", {
        x1: offsetX - markerExtend + 5,
        y1: pos,
        x2: cx - halfW - 2,
        y2: pos,
        stroke: mc.color,
        "stroke-width": mc.lineWidth,
        "stroke-dasharray": marker.primary ? "none" : "4,2",
    });
    lineGroup.appendChild(line);

    // Right line
    const lineR = svgEl("line", {
        x1: cx + halfW + 2,
        y1: pos,
        x2: cx + halfW + markerExtend - 5,
        y2: pos,
        stroke: mc.color,
        "stroke-width": mc.lineWidth,
        "stroke-dasharray": marker.primary ? "none" : "4,2",
    });
    lineGroup.appendChild(lineR);

    svg.appendChild(lineGroup);

    // Triangular indicator on the left
    const triSize = mc.triangleSize;
    const triX = offsetX - markerExtend + 2;
    const triangle = svgEl("polygon", {
        points: `${triX},${pos} ${triX + triSize},${pos - triSize / 2} ${triX + triSize},${pos + triSize / 2}`,
        fill: mc.color,
        class: "gene-marker",
        filter: `url(#glow-${marker.chrId || ''})`,
    });
    svg.appendChild(triangle);

    // Gene label on the right
    if (marker.label) {
        const label = svgEl("text", {
            x: cx + halfW + markerExtend - 2,
            y: pos + 4,
            "font-size": marker.primary ? "11" : "9",
            "font-family": "'SF Mono', 'Fira Code', Consolas, monospace",
            "font-weight": marker.primary ? "700" : "400",
            fill: marker.primary ? mc.color : "#94a3b8",
        });
        label.textContent = marker.label;
        svg.appendChild(label);
    }
}

/**
 * Draw the full karyotype (all chromosomes).
 */
function drawKaryotype(container, highlightedChr = null, selectedGene = null) {
    container.innerHTML = "";

    CHR_ORDER.forEach(chrId => {
        const col = document.createElement("div");
        col.className = "chromosome-col";
        if (highlightedChr === chrId) col.classList.add("highlighted");
        col.dataset.chr = chrId;

        // Collect gene markers for this chromosome
        const markers = [];
        if (selectedGene && selectedGene.chr === chrId) {
            markers.push({
                start: selectedGene.start,
                end: selectedGene.end,
                label: selectedGene.symbol,
                primary: true,
                chrId: chrId,
            });
        }

        // Also show other genes on highlighted chromosome as dim markers
        if (highlightedChr === chrId && GENES_BY_CHR[chrId]) {
            GENES_BY_CHR[chrId].forEach(gene => {
                if (!selectedGene || gene.symbol !== selectedGene.symbol) {
                    markers.push({
                        start: gene.start,
                        end: gene.end,
                        label: "",
                        primary: false,
                        chrId: chrId,
                    });
                }
            });
        }

        const svg = drawChromosome(chrId, VIS_CONFIG.karyotype, markers);
        if (svg) col.appendChild(svg);

        // Chromosome label
        const label = document.createElement("div");
        label.className = "chr-label";
        label.textContent = chrId;
        col.appendChild(label);

        container.appendChild(col);
    });
}

/**
 * Draw detailed chromosome view for the detail panel.
 */
function drawDetailChromosome(container, gene) {
    container.innerHTML = "";

    const markers = [{
        start: gene.start,
        end: gene.end,
        label: gene.symbol,
        primary: true,
        chrId: gene.chr,
    }];

    // Add other genes on this chromosome as secondary markers
    if (GENES_BY_CHR[gene.chr]) {
        GENES_BY_CHR[gene.chr].forEach(g => {
            if (g.symbol !== gene.symbol) {
                markers.push({
                    start: g.start,
                    end: g.end,
                    label: g.symbol,
                    primary: false,
                    chrId: gene.chr,
                });
            }
        });
    }

    const svg = drawChromosome(gene.chr, VIS_CONFIG.detail, markers);
    if (svg) {
        // Add arm labels
        const chrData = CHROMOSOMES[gene.chr];
        const scale = VIS_CONFIG.detail.maxChrHeight / MAX_CHR_SIZE;
        const centMidY = ((chrData.centromereStart + chrData.centromereEnd) / 2) * scale + 10;

        // p arm label
        const pLabel = svgEl("text", {
            x: 4, y: centMidY - 15,
            "font-size": "10",
            fill: "#64748b",
            "font-family": "'SF Mono', monospace",
        });
        pLabel.textContent = "p";
        svg.appendChild(pLabel);

        // q arm label
        const qLabel = svgEl("text", {
            x: 4, y: centMidY + 20,
            "font-size": "10",
            fill: "#64748b",
            "font-family": "'SF Mono', monospace",
        });
        qLabel.textContent = "q";
        svg.appendChild(qLabel);

        container.appendChild(svg);
    }

    // Add chromosome number label below
    const chrLabel = document.createElement("div");
    chrLabel.style.cssText = "text-align:center; font-family:var(--font-mono); font-size:0.85rem; color:var(--text-muted); margin-top:0.5rem;";
    chrLabel.textContent = `Chromosome ${gene.chr}`;
    container.appendChild(chrLabel);
}
