/**
 * Human Reference Genome (GRCh38/hg38) chromosome data.
 * Sizes and centromere positions based on NCBI/UCSC genome assembly data.
 */
const CHROMOSOMES = {
    "1":  { size: 248956422, centromereStart: 122026460, centromereEnd: 125184587 },
    "2":  { size: 242193529, centromereStart: 92188146,  centromereEnd: 94090557 },
    "3":  { size: 198295559, centromereStart: 90772459,  centromereEnd: 93655574 },
    "4":  { size: 190214555, centromereStart: 49712061,  centromereEnd: 51743951 },
    "5":  { size: 181538259, centromereStart: 46485901,  centromereEnd: 50059807 },
    "6":  { size: 170805979, centromereStart: 58553889,  centromereEnd: 59829934 },
    "7":  { size: 159345973, centromereStart: 58169654,  centromereEnd: 60828234 },
    "8":  { size: 145138636, centromereStart: 44033745,  centromereEnd: 45877265 },
    "9":  { size: 138394717, centromereStart: 43389635,  centromereEnd: 45518558 },
    "10": { size: 133797422, centromereStart: 39686683,  centromereEnd: 41593521 },
    "11": { size: 135086622, centromereStart: 51078349,  centromereEnd: 54425074 },
    "12": { size: 133275309, centromereStart: 34769408,  centromereEnd: 37185252 },
    "13": { size: 114364328, centromereStart: 16000000,  centromereEnd: 18051248 },
    "14": { size: 107043718, centromereStart: 16000000,  centromereEnd: 18173523 },
    "15": { size: 101991189, centromereStart: 17083674,  centromereEnd: 19725254 },
    "16": { size: 90338345,  centromereStart: 36311159,  centromereEnd: 38265669 },
    "17": { size: 83257441,  centromereStart: 22813680,  centromereEnd: 26885980 },
    "18": { size: 80373285,  centromereStart: 15460900,  centromereEnd: 20861206 },
    "19": { size: 58617616,  centromereStart: 24498981,  centromereEnd: 27190874 },
    "20": { size: 64444167,  centromereStart: 26436233,  centromereEnd: 30038348 },
    "21": { size: 46709983,  centromereStart: 10864561,  centromereEnd: 12915808 },
    "22": { size: 50818468,  centromereStart: 12954789,  centromereEnd: 15054318 },
    "X":  { size: 156040895, centromereStart: 58605580,  centromereEnd: 62412542 },
    "Y":  { size: 57227415,  centromereStart: 10316945,  centromereEnd: 10544039 }
};

const CHR_ORDER = [
    "1","2","3","4","5","6","7","8","9","10","11","12",
    "13","14","15","16","17","18","19","20","21","22","X","Y"
];

const MAX_CHR_SIZE = Math.max(...Object.values(CHROMOSOMES).map(c => c.size));
