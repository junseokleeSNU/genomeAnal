/**
 * Main application controller.
 * Handles search, selection, filtering, and UI interactions.
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

    // ===== Initialization =====

    function init() {
        drawKaryotype(karyotypeContainer);
        populateFilters();
        renderGeneTable();
        bindEvents();
        searchStatus.textContent = `${GENES.length} genes available \u2022 type to search`;
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
            searchStatus.textContent = `${GENES.length} genes available \u2022 type to search`;
            return;
        }
        const results = searchGenes(query);
        showSuggestions(results);
        activeSuggestionIdx = -1;
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

    function searchGenes(query) {
        const q = query.toLowerCase();
        const scored = GENES.map(gene => {
            let score = 0;
            const sym = gene.symbol.toLowerCase();
            const name = gene.name.toLowerCase();
            const desc = gene.description.toLowerCase();

            if (sym === q) score = 100;
            else if (sym.startsWith(q)) score = 80;
            else if (sym.includes(q)) score = 60;
            else if (name.toLowerCase().startsWith(q)) score = 50;
            else if (name.includes(q)) score = 40;
            else if (gene.band.toLowerCase().includes(q)) score = 30;
            else if (desc.includes(q)) score = 20;
            else score = 0;

            return { gene, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

        return scored.map(r => r.gene);
    }

    function onSearchSubmit() {
        const query = searchInput.value.trim();
        if (!query) return;

        // Try exact symbol match first
        const exact = GENE_BY_SYMBOL[query.toUpperCase()];
        if (exact) {
            selectGene(exact);
            hideSuggestions();
            return;
        }

        // Try first search result
        const results = searchGenes(query);
        if (results.length > 0) {
            selectGene(results[0]);
            hideSuggestions();
        } else {
            searchStatus.textContent = `No genes found for "${query}"`;
            searchStatus.style.color = "#f59e0b";
            setTimeout(() => { searchStatus.style.color = ""; }, 3000);
        }
    }

    function onClear() {
        searchInput.value = "";
        selectedGene = null;
        hideSuggestions();
        clearBtn.style.display = "none";
        detailPlaceholder.style.display = "";
        detailContent.style.display = "none";
        drawKaryotype(karyotypeContainer);
        searchStatus.textContent = `${GENES.length} genes available \u2022 type to search`;
        highlightTableRow(null);
    }

    // ===== Suggestions =====

    function showSuggestions(genes) {
        suggestionsEl.innerHTML = "";
        if (genes.length === 0) {
            hideSuggestions();
            return;
        }

        genes.forEach(gene => {
            const item = document.createElement("div");
            item.className = "suggestion-item";
            item.innerHTML = `
                <span class="suggestion-symbol">${gene.symbol}</span>
                <span class="suggestion-name">${gene.name}</span>
                <span class="suggestion-chr">chr${gene.chr}</span>
            `;
            item.addEventListener("click", () => {
                selectGene(gene);
                hideSuggestions();
            });
            suggestionsEl.appendChild(item);
        });

        suggestionsEl.classList.add("active");
    }

    function hideSuggestions() {
        suggestionsEl.classList.remove("active");
        suggestionsEl.innerHTML = "";
        activeSuggestionIdx = -1;
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
        searchStatus.textContent = `${gene.symbol} \u2022 Chromosome ${gene.chr} \u2022 ${gene.band}`;

        // Highlight in table
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
        document.getElementById("detail-start").textContent = gene.start.toLocaleString() + " bp";
        document.getElementById("detail-end").textContent = gene.end.toLocaleString() + " bp";
        document.getElementById("detail-size").textContent = formatSize(gene.end - gene.start);
        document.getElementById("detail-description").textContent = gene.description;

        // Draw detail chromosome
        drawDetailChromosome(document.getElementById("detail-chromosome-svg"), gene);

        // External links
        document.getElementById("link-ncbi").href =
            `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(gene.symbol)}[sym]+AND+human[orgn]`;
        document.getElementById("link-ensembl").href =
            `https://www.ensembl.org/Homo_sapiens/Search/Results?q=${encodeURIComponent(gene.symbol)};site=ensembl`;
        document.getElementById("link-ucsc").href =
            `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr${gene.chr}:${gene.start}-${gene.end}`;
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
            // If clicking the same chromosome that's already highlighted, cycle genes
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

        // Sort
        filtered.sort((a, b) => {
            let va = a[sortColumn] || "";
            let vb = b[sortColumn] || "";

            // Special chromosome sort order
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
                <td class="gene-symbol-cell">${gene.symbol}</td>
                <td>${gene.name}</td>
                <td class="gene-chr-cell">${gene.chr}</td>
                <td class="gene-band-cell">${gene.band}</td>
            `;

            tr.addEventListener("click", () => selectGene(gene));
            geneTableBody.appendChild(tr);
        });
    }

    function highlightTableRow(symbol) {
        geneTableBody.querySelectorAll("tr").forEach(tr => {
            tr.classList.toggle("selected", tr.dataset.symbol === symbol);
        });
        // Scroll selected row into view
        const selected = geneTableBody.querySelector("tr.selected");
        if (selected) {
            selected.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    // ===== Start =====
    init();
})();
