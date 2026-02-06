# Human Genome Sequence Visualizer

Interactive web-based visualization of the human reference genome (GRCh38/hg38). Search for genes and see their locations marked on chromosome ideograms.

## Features

- **Full human karyotype** - All 24 chromosomes (1-22, X, Y) rendered as SVG ideograms with centromere pinching and banding patterns
- **Gene search** - Search by gene symbol, name, cytogenetic band, or description with autocomplete suggestions
- **Location marking** - Selected genes are highlighted with animated markers showing their position on the chromosome
- **Detail panel** - View gene coordinates, cytogenetic band, size, description, and a zoomed chromosome view
- **Gene catalog** - Sortable/filterable table of 60 curated genes (oncogenes, tumor suppressors, disease genes)
- **External links** - Direct links to NCBI Gene, Ensembl, and UCSC Genome Browser for each gene

## Quick Start

Open `index.html` in a browser. No build step or server required.

```bash
# Or serve locally:
python3 -m http.server 8000
# Then open http://localhost:8000
```

## Data Sources

- Chromosome sizes and centromere positions: GRCh38/hg38 assembly (NCBI/UCSC)
- Gene coordinates: NCBI Gene and Ensembl (GRCh38)
- 60 curated genes including TP53, BRCA1/2, EGFR, KRAS, CFTR, HTT, HBB, and more

## Project Structure

```
index.html            Main webpage
css/style.css         Styles (dark theme)
js/chromosomes.js     Chromosome size/centromere data
js/genes.js           Curated gene database
js/visualization.js   SVG chromosome rendering engine
js/app.js             Application controller (search, UI)
data/                 Raw JSON data files
```
