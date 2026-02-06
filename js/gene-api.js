/**
 * Gene API module - queries MyGene.info for any human coding gene.
 * MyGene.info is a free, CORS-enabled REST API with GRCh38 coordinates.
 * https://mygene.info/
 */

const GeneAPI = (function () {
    "use strict";

    const BASE_URL = "https://mygene.info/v3";
    const CACHE = new Map();
    const SEARCH_CACHE = new Map();

    /**
     * Search for genes by query string.
     * Returns array of gene objects with symbol, name, chr, start, end, band.
     */
    async function search(query, size = 15) {
        if (!query || query.trim().length === 0) return [];

        const cacheKey = query.trim().toLowerCase() + "|" + size;
        if (SEARCH_CACHE.has(cacheKey)) return SEARCH_CACHE.get(cacheKey);

        const params = new URLSearchParams({
            q: query.trim(),
            species: "human",
            fields: "symbol,name,genomic_pos,type_of_gene,map_location,entrezgene,ensembl.gene,summary",
            size: size.toString(),
        });

        try {
            const resp = await fetch(`${BASE_URL}/query?${params}`);
            if (!resp.ok) throw new Error(`API error: ${resp.status}`);
            const data = await resp.json();

            if (!data.hits || data.hits.length === 0) return [];

            const genes = data.hits
                .map(hit => parseHit(hit))
                .filter(g => g !== null);

            SEARCH_CACHE.set(cacheKey, genes);
            return genes;
        } catch (err) {
            console.warn("GeneAPI search failed:", err);
            return [];
        }
    }

    /**
     * Fetch detailed gene info by symbol (exact match).
     * Tries symbol query first for best results.
     */
    async function fetchBySymbol(symbol) {
        if (!symbol) return null;

        const upper = symbol.trim().toUpperCase();
        if (CACHE.has(upper)) return CACHE.get(upper);

        const params = new URLSearchParams({
            q: `symbol:${upper} AND type_of_gene:protein-coding`,
            species: "human",
            fields: "symbol,name,genomic_pos,type_of_gene,map_location,entrezgene,ensembl.gene,summary,alias",
            size: "5",
        });

        try {
            const resp = await fetch(`${BASE_URL}/query?${params}`);
            if (!resp.ok) throw new Error(`API error: ${resp.status}`);
            const data = await resp.json();

            if (!data.hits || data.hits.length === 0) {
                // Fallback: try broader search without protein-coding filter
                return await fetchBySymbolBroad(upper);
            }

            // Find exact symbol match
            const exactHit = data.hits.find(h => h.symbol && h.symbol.toUpperCase() === upper);
            const hit = exactHit || data.hits[0];
            const gene = parseHit(hit);

            if (gene) {
                CACHE.set(upper, gene);
            }
            return gene;
        } catch (err) {
            console.warn("GeneAPI fetchBySymbol failed:", err);
            return null;
        }
    }

    /**
     * Broader fallback search for non-protein-coding genes.
     */
    async function fetchBySymbolBroad(symbol) {
        const params = new URLSearchParams({
            q: `symbol:${symbol}`,
            species: "human",
            fields: "symbol,name,genomic_pos,type_of_gene,map_location,entrezgene,ensembl.gene,summary,alias",
            size: "5",
        });

        try {
            const resp = await fetch(`${BASE_URL}/query?${params}`);
            if (!resp.ok) return null;
            const data = await resp.json();

            if (!data.hits || data.hits.length === 0) return null;

            const exactHit = data.hits.find(h => h.symbol && h.symbol.toUpperCase() === symbol);
            const hit = exactHit || data.hits[0];
            const gene = parseHit(hit);

            if (gene) {
                CACHE.set(symbol, gene);
            }
            return gene;
        } catch (err) {
            return null;
        }
    }

    /**
     * Fetch gene by Entrez Gene ID.
     */
    async function fetchById(geneId) {
        if (!geneId) return null;

        const cacheKey = "id:" + geneId;
        if (CACHE.has(cacheKey)) return CACHE.get(cacheKey);

        const fields = "symbol,name,genomic_pos,type_of_gene,map_location,entrezgene,ensembl.gene,summary,alias";

        try {
            const resp = await fetch(`${BASE_URL}/gene/${geneId}?fields=${fields}`);
            if (!resp.ok) return null;
            const hit = await resp.json();
            const gene = parseHit(hit);

            if (gene) {
                CACHE.set(cacheKey, gene);
                CACHE.set(gene.symbol.toUpperCase(), gene);
            }
            return gene;
        } catch (err) {
            return null;
        }
    }

    /**
     * Parse an API hit into our standard gene format.
     */
    function parseHit(hit) {
        if (!hit || !hit.symbol) return null;

        // Extract genomic position (GRCh38)
        let chr = null, start = null, end = null;

        const gpos = hit.genomic_pos;
        if (gpos) {
            // genomic_pos can be an object or an array (for genes on multiple assemblies)
            const pos = Array.isArray(gpos) ? findHg38Pos(gpos) : gpos;
            if (pos && pos.chr && pos.start && pos.end) {
                chr = normalizeChromosome(pos.chr);
                start = pos.start;
                end = pos.end;
            }
        }

        // If we couldn't get position, try to extract chr from map_location
        if (!chr && hit.map_location) {
            chr = extractChrFromMapLocation(hit.map_location);
        }

        // Must have at least chromosome to be useful
        if (!chr || !CHROMOSOMES[chr]) return null;

        const band = hit.map_location || chr;
        const geneType = hit.type_of_gene || "unknown";
        const entrezId = hit.entrezgene || null;
        const ensemblId = (hit.ensembl && hit.ensembl.gene) ?
            (Array.isArray(hit.ensembl.gene) ? hit.ensembl.gene[0] : hit.ensembl.gene) :
            (hit.ensembl ? (typeof hit.ensembl === "string" ? hit.ensembl : null) : null);

        return {
            symbol: hit.symbol,
            name: hit.name || hit.symbol,
            chr: chr,
            start: start || 0,
            end: end || 0,
            band: band,
            category: categorizeGeneType(geneType),
            geneType: geneType,
            description: hit.summary || `${hit.name || hit.symbol} - ${geneType} gene on chromosome ${chr} (${band}).`,
            entrezId: entrezId,
            ensemblId: ensemblId,
            source: "api",
        };
    }

    /**
     * Find the hg38 position from an array of genomic_pos entries.
     */
    function findHg38Pos(posArray) {
        // Prefer entries that look like standard chromosomes
        for (const pos of posArray) {
            const chr = normalizeChromosome(pos.chr);
            if (chr && CHROMOSOMES[chr]) return pos;
        }
        return posArray[0] || null;
    }

    /**
     * Normalize chromosome identifier to our format.
     */
    function normalizeChromosome(chr) {
        if (!chr) return null;
        let s = String(chr).replace(/^chr/i, "").toUpperCase();
        // Map "MT" to null (we don't display mitochondrial)
        if (s === "MT" || s === "M") return null;
        // Validate
        if (CHROMOSOMES[s]) return s;
        return null;
    }

    /**
     * Extract chromosome from map_location string like "17p13.1".
     */
    function extractChrFromMapLocation(mapLoc) {
        if (!mapLoc) return null;
        const match = mapLoc.match(/^(\d+|X|Y)/i);
        if (match) {
            return normalizeChromosome(match[1]);
        }
        return null;
    }

    /**
     * Map API gene type to our category system.
     */
    function categorizeGeneType(geneType) {
        if (!geneType) return "other";
        const t = geneType.toLowerCase();
        if (t === "protein-coding") return "protein_coding";
        if (t.includes("pseudo")) return "pseudogene";
        if (t.includes("ncrna") || t.includes("rrna") || t.includes("trna") || t.includes("snrna") || t.includes("scrna")) return "noncoding_rna";
        return "other";
    }

    return { search, fetchBySymbol, fetchById };
})();
