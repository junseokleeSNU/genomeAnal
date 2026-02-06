/**
 * Main application controller.
 * Handles search (local + MyGene.info API), selection, filtering, and UI.
 */

(function () {
    "use strict";

    // DOM references
    const searchInput = document.getElementById("gene-search");
    const searchBtn = document.getElementById("search-btn");
    const clearBtn = document.getElementById("clear-btn");
    const suggestionsEl = document.getElementById("search-suggestions");
    const searchStatus = document.getElementById("search-status");
    const karyotypeContainer = document.getElementById("karyotype-container");
    const detailPlaceholder = document.getElementById("detail-placeholder");
    const detailContent = document.getElementById("detail-content");
    const geneTableBody = document.getElementById("gene-table-body");
    const chrFilter = document.getElementById("chr-filter");
    const categoryFilter = document.getElementById("category-filter");

    let selectedGene = null;
    let activeSuggestionIdx = -1;
    let sortColumn = "symbol";
    let sortAsc = true;

    // Debounce timer for API search
    let searchDebounceTimer = null;
    const DEBOUNCE_MS = 300;

    // Track in-flight API search to avoid stale results
    let searchGeneration = 0;

    // ===== Initialization =====

    function init() {
        drawKaryotype(karyotypeContainer);
        populateFilters();
        renderGeneTable();
        bindEvents();
        searchStatus.textContent = `${GENES.length} curated genes + all human coding genes via API`;
    }

    function populateFilters() {
        CHR_ORDER.forEach(chrId => {
            const opt = document.createElement("option");
            opt.value = chrId;
            opt.textContent = `Chr ${chrId}`;
            chrFilter.appendChild(opt);
        });
    }

    // ===== Event Binding =====

    function bindEvents() {
        searchInput.addEventListener("input", onSearchInput);
        searchInput.addEventListener("keydown", onSearchKeydown);
        searchBtn.addEventListener("click", onSearchSubmit);
        clearBtn.addEventListener("click", onClear);

        document.addEventListener("click", (e) => {
            if (!suggestionsEl.contains(e.target) && e.target !== searchInput) {
                hideSuggestions();
            }
        });

        karyotypeContainer.addEventListener("click", onKaryotypeClick);

        chrFilter.addEventListener("change", renderGeneTable);
        categoryFilter.addEventListener("change", renderGeneTable);

        document.querySelectorAll("#gene-table th[data-sort]").forEach(th => {
            th.addEventListener("click", () => {
                const col = th.dataset.sort;
                if (sortColumn === col) {
                    sortAsc = !sortAsc;
                } else {
                    sortColumn = col;
                    sortAsc = true;
                }
                renderGeneTable();
            });
        });
    }

    // ===== Search =====

    function onSearchInput() {
        const query = searchInput.value.trim();
        if (query.length === 0) {
            hideSuggestions();
            clearDebounce();
            searchStatus.textContent = `${GENES.length} curated genes + all human coding genes via API`;
            return;
        }

        // Show local results immediately
        const localResults = searchGenesLocal(query);
        if (localResults.length > 0) {
            showSuggestions(localResults, false);
        }

        // Debounce API search
        clearDebounce();
        if (query.length >= 2) {
            searchDebounceTimer = setTimeout(() => {
                fetchAPISuggestions(query, localResults);
            }, DEBOUNCE_MS);
        }

        activeSuggestionIdx = -1;
    }

    function clearDebounce() {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
    }

    async function fetchAPISuggestions(query, existingLocal) {
        const gen = ++searchGeneration;

        // Show loading indicator in suggestions
        setSearchLoading(true);

        try {
            const apiResults = await GeneAPI.search(query, 12);

            // Abort if a newer search is in flight
            if (gen !== searchGeneration) return;

            // Merge: local results first (deduped), then API results
            const merged = mergeResults(existingLocal, apiResults);
            showSuggestions(merged, true);
        } catch (err) {
            // Silently fall back to local-only results
            if (gen === searchGeneration) {
                showSuggestions(existingLocal, true);
            }
        } finally {
            if (gen === searchGeneration) {
                setSearchLoading(false);
            }
        }
    }

    /**
     * Merge local curated results with API results, deduplicating by symbol.
     */
    function mergeResults(local, api) {
        const seen = new Set(local.map(g => g.symbol.toUpperCase()));
        const merged = [...local];

        for (const gene of api) {
            if (!seen.has(gene.symbol.toUpperCase())) {
                seen.add(gene.symbol.toUpperCase());
                merged.push(gene);
            }
        }

        return merged.slice(0, 15);
    }

    function setSearchLoading(isLoading) {
        searchBtn.textContent = isLoading ? "..." : "Search";
        searchBtn.disabled = isLoading;
    }

    function onSearchKeydown(e) {
        const items = suggestionsEl.querySelectorAll(".suggestion-item");
        if (!items.length) {
            if (e.key === "Enter") onSearchSubmit();
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeSuggestionIdx = Math.min(activeSuggestionIdx + 1, items.length - 1);
            updateActiveSuggestion(items);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeSuggestionIdx = Math.max(activeSuggestionIdx - 1, -1);
            updateActiveSuggestion(items);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeSuggestionIdx >= 0 && activeSuggestionIdx < items.length) {
                items[activeSuggestionIdx].click();
            } else {
                onSearchSubmit();
            }
        } else if (e.key === "Escape") {
            hideSuggestions();
        }
    }

    function updateActiveSuggestion(items) {
        items.forEach((item, i) => {
            item.classList.toggle("active", i === activeSuggestionIdx);
        });
        if (activeSuggestionIdx >= 0 && items[activeSuggestionIdx]) {
            items[activeSuggestionIdx].scrollIntoView({ block: "nearest" });
        }
    }

    /**
     * Search local curated genes only (instant, no network).
     */
    function searchGenesLocal(query) {
        const q = query.toLowerCase();
        const scored = GENES.map(gene => {
            let score = 0;
            const sym = gene.symbol.toLowerCase();
            const name = gene.name.toLowerCase();
            const desc = gene.description.toLowerCase();

            if (sym === q) score = 100;
            else if (sym.startsWith(q)) score = 80;
            else if (sym.includes(q)) score = 60;
            else if (name.startsWith(q)) score = 50;
            else if (name.includes(q)) score = 40;
            else if (gene.band.toLowerCase().includes(q)) score = 30;
            else if (desc.includes(q)) score = 20;

            return { gene, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

        return scored.map(r => r.gene);
    }

    /**
     * Submit search: try local exact match -> API exact fetch -> API search.
     */
    async function onSearchSubmit() {
        const query = searchInput.value.trim();
        if (!query) return;

        clearDebounce();
        hideSuggestions();

        // 1. Try local exact match
        const localExact = GENE_BY_SYMBOL[query.toUpperCase()];
        if (localExact) {
            selectGene(localExact);
            return;
        }

        // 2. Try local search
        const localResults = searchGenesLocal(query);
        if (localResults.length > 0 && localResults[0].symbol.toUpperCase() === query.toUpperCase()) {
            selectGene(localResults[0]);
            return;
        }

        // 3. Query API
        setSearchLoading(true);
        searchStatus.textContent = `Searching for "${query}"...`;
        searchStatus.style.color = "";

        try {
            // Try exact symbol fetch first
            let gene = await GeneAPI.fetchBySymbol(query);

            if (gene) {
                selectGene(gene);
                return;
            }

            // Try broader search
            const apiResults = await GeneAPI.search(query, 5);
            if (apiResults.length > 0) {
                selectGene(apiResults[0]);
                return;
            }

            // Nothing found anywhere
            searchStatus.textContent = `No gene found for "${query}" - try a different symbol or name`;
            searchStatus.style.color = "#f59e0b";
            setTimeout(() => { searchStatus.style.color = ""; }, 4000);
        } catch (err) {
            searchStatus.textContent = `Search failed - check connection and try again`;
            searchStatus.style.color = "#ef4444";
            setTimeout(() => { searchStatus.style.color = ""; }, 4000);
        } finally {
            setSearchLoading(false);
        }
    }

    function onClear() {
        searchInput.value = "";
        selectedGene = null;
        clearDebounce();
        hideSuggestions();
        clearBtn.style.display = "none";
        detailPlaceholder.style.display = "";
        detailContent.style.display = "none";
        drawKaryotype(karyotypeContainer);
        searchStatus.textContent = `${GENES.length} curated genes + all human coding genes via API`;
        highlightTableRow(null);
    }

    // ===== Suggestions =====

    /**
     * Show suggestion dropdown items.
     * @param {Array} genes - gene objects to display
     * @param {boolean} apiDone - whether API search has completed
     */
    function showSuggestions(genes, apiDone) {
        suggestionsEl.innerHTML = "";
        if (genes.length === 0 && apiDone) {
            // Show "no results" message
            const noResult = document.createElement("div");
            noResult.className = "suggestion-item";
            noResult.style.color = "var(--text-muted)";
            noResult.style.justifyContent = "center";
            noResult.style.cursor = "default";
            noResult.textContent = "No genes found - try pressing Enter for full search";
            suggestionsEl.appendChild(noResult);
            suggestionsEl.classList.add("active");
            return;
        }

        if (genes.length === 0) {
            hideSuggestions();
            return;
        }

        genes.forEach(gene => {
            const item = document.createElement("div");
            item.className = "suggestion-item";

            const isApi = gene.source === "api";
            const sourceTag = isApi ? '<span class="suggestion-source">API</span>' : '';

            item.innerHTML = `
                <span class="suggestion-symbol">${escapeHtml(gene.symbol)}</span>
                <span class="suggestion-name">${escapeHtml(gene.name)}</span>
                ${sourceTag}
                <span class="suggestion-chr">chr${escapeHtml(gene.chr)}</span>
            `;
            item.addEventListener("click", () => {
                selectGene(gene);
                hideSuggestions();
            });
            suggestionsEl.appendChild(item);
        });

        // If API is still loading, show a footer
        if (!apiDone) {
            const loading = document.createElement("div");
            loading.className = "suggestion-loading";
            loading.textContent = "Searching all genes...";
            suggestionsEl.appendChild(loading);
        }

        suggestionsEl.classList.add("active");
    }

    function hideSuggestions() {
        suggestionsEl.classList.remove("active");
        suggestionsEl.innerHTML = "";
        activeSuggestionIdx = -1;
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== Gene Selection =====

    function selectGene(gene) {
        selectedGene = gene;
        searchInput.value = gene.symbol;
        clearBtn.style.display = "";

        // Update karyotype
        drawKaryotype(karyotypeContainer, gene.chr, gene);

        // Update detail panel
        showGeneDetail(gene);

        // Update status
        const sourceLabel = gene.source === "api" ? " (via API)" : "";
        searchStatus.textContent = `${gene.symbol} \u2022 Chromosome ${gene.chr} \u2022 ${gene.band}${sourceLabel}`;
        searchStatus.style.color = "";

        // Highlight in table (only works for curated genes)
        highlightTableRow(gene.symbol);

        // Scroll to highlighted chromosome
        const chrCol = karyotypeContainer.querySelector(`[data-chr="${gene.chr}"]`);
        if (chrCol) {
            chrCol.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }

    function showGeneDetail(gene) {
        detailPlaceholder.style.display = "none";
        detailContent.style.display = "";

        document.getElementById("detail-gene-symbol").textContent = gene.symbol;
        document.getElementById("detail-gene-name").textContent = gene.name;
        document.getElementById("detail-chr").textContent = `Chromosome ${gene.chr}`;
        document.getElementById("detail-band").textContent = gene.band;

        if (gene.start && gene.end) {
            document.getElementById("detail-start").textContent = gene.start.toLocaleString() + " bp";
            document.getElementById("detail-end").textContent = gene.end.toLocaleString() + " bp";
            document.getElementById("detail-size").textContent = formatSize(gene.end - gene.start);
        } else {
            document.getElementById("detail-start").textContent = "N/A";
            document.getElementById("detail-end").textContent = "N/A";
            document.getElementById("detail-size").textContent = "N/A";
        }

        document.getElementById("detail-description").textContent = gene.description;

        // Gene type badge
        const typeEl = document.getElementById("detail-gene-type");
        if (typeEl) {
            typeEl.textContent = gene.geneType || gene.category || "";
            typeEl.style.display = (gene.geneType || gene.category) ? "" : "none";
        }

        // Entrez ID
        const entrezEl = document.getElementById("detail-entrez-id");
        if (entrezEl) {
            entrezEl.textContent = gene.entrezId ? `Entrez: ${gene.entrezId}` : "";
        }

        // Ensembl ID
        const ensemblIdEl = document.getElementById("detail-ensembl-id");
        if (ensemblIdEl) {
            ensemblIdEl.textContent = gene.ensemblId ? `Ensembl: ${gene.ensemblId}` : "";
        }

        // Draw detail chromosome
        if (gene.start && gene.end) {
            drawDetailChromosome(document.getElementById("detail-chromosome-svg"), gene);
        }

        // External links
        const ncbiLink = document.getElementById("link-ncbi");
        const ensemblLink = document.getElementById("link-ensembl");
        const ucscLink = document.getElementById("link-ucsc");

        if (gene.entrezId) {
            ncbiLink.href = `https://www.ncbi.nlm.nih.gov/gene/${gene.entrezId}`;
        } else {
            ncbiLink.href = `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(gene.symbol)}[sym]+AND+human[orgn]`;
        }

        if (gene.ensemblId) {
            ensemblLink.href = `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(gene.ensemblId)}`;
        } else {
            ensemblLink.href = `https://www.ensembl.org/Homo_sapiens/Search/Results?q=${encodeURIComponent(gene.symbol)};site=ensembl`;
        }

        if (gene.start && gene.end) {
            ucscLink.href = `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr${gene.chr}:${gene.start}-${gene.end}`;
        } else {
            ucscLink.href = `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr${gene.chr}`;
        }
    }

    function formatSize(bp) {
        if (bp >= 1e6) return (bp / 1e6).toFixed(2) + " Mb";
        if (bp >= 1e3) return (bp / 1e3).toFixed(1) + " kb";
        return bp + " bp";
    }

    // ===== Karyotype Interaction =====

    function onKaryotypeClick(e) {
        const col = e.target.closest(".chromosome-col");
        if (!col) return;

        const chrId = col.dataset.chr;
        const genesOnChr = GENES_BY_CHR[chrId];

        if (genesOnChr && genesOnChr.length > 0) {
            if (selectedGene && selectedGene.chr === chrId) {
                const currentIdx = genesOnChr.findIndex(g => g.symbol === selectedGene.symbol);
                const nextIdx = (currentIdx + 1) % genesOnChr.length;
                selectGene(genesOnChr[nextIdx]);
            } else {
                selectGene(genesOnChr[0]);
            }
        }
    }

    // ===== Gene Table =====

    function renderGeneTable() {
        const chrVal = chrFilter.value;
        const catVal = categoryFilter.value;

        let filtered = GENES.filter(gene => {
            if (chrVal && gene.chr !== chrVal) return false;
            if (catVal && gene.category !== catVal) return false;
            return true;
        });

        filtered.sort((a, b) => {
            let va = a[sortColumn] || "";
            let vb = b[sortColumn] || "";

            if (sortColumn === "chr") {
                va = CHR_ORDER.indexOf(va);
                vb = CHR_ORDER.indexOf(vb);
            }

            if (typeof va === "string") {
                va = va.toLowerCase();
                vb = vb.toLowerCase();
            }

            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });

        geneTableBody.innerHTML = "";

        filtered.forEach(gene => {
            const tr = document.createElement("tr");
            tr.dataset.symbol = gene.symbol;
            if (selectedGene && selectedGene.symbol === gene.symbol) {
                tr.classList.add("selected");
            }

            tr.innerHTML = `
                <td class="gene-symbol-cell">${escapeHtml(gene.symbol)}</td>
                <td>${escapeHtml(gene.name)}</td>
                <td class="gene-chr-cell">${escapeHtml(gene.chr)}</td>
                <td class="gene-band-cell">${escapeHtml(gene.band)}</td>
            `;

            tr.addEventListener("click", () => selectGene(gene));
            geneTableBody.appendChild(tr);
        });
    }

    function highlightTableRow(symbol) {
        geneTableBody.querySelectorAll("tr").forEach(tr => {
            tr.classList.toggle("selected", tr.dataset.symbol === symbol);
        });
        const selected = geneTableBody.querySelector("tr.selected");
        if (selected) {
            selected.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    // ===== Start =====
    init();
})();
