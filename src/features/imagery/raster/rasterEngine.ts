import type { RasterData, RasterOperationParams, RasterResult, RasterStats, ReclassRule } from "./rasterTypes";
import { bboxOfGeometry, clamp, percentile, pointInGeometry, valid } from "./rasterUtils";
import { validateOperation, validateRaster } from "./rasterValidation";

export type RasterProgress = (progress: number, message: string) => void;
const noop: RasterProgress = () => {};
const valueAt = (band: Float32Array | undefined, index: number, nodata: number | null) => band && valid(band[index], nodata) ? band[index] : null;

export function rasterStatistics(values: ArrayLike<number>, nodata: number | null, bins = 32): { stats: RasterStats; histogram: number[]; binEdges: number[] } {
  if (!Number.isInteger(bins) || bins < 1 || bins > 512) throw new Error("raster.invalidMetadata");
  const usable: number[] = []; let nodataCount = 0;
  for (let i = 0; i < values.length; i++) { const value = values[i]; if (valid(value, nodata)) usable.push(value); else nodataCount++; }
  if (!usable.length) throw new Error("raster.noValidPixels");
  let min = Infinity; let max = -Infinity; let sum = 0; for (const value of usable) { min = Math.min(min, value); max = Math.max(max, value); sum += value; } const mean = sum / usable.length;
  const variance = usable.reduce((a, b) => a + (b - mean) ** 2, 0) / usable.length;
  const edges = Array.from({ length: Math.max(1, bins) + 1 }, (_, i) => min + (max - min || 1) * i / Math.max(1, bins));
  const histogram = new Array(Math.max(1, bins)).fill(0) as number[];
  usable.forEach(value => { const bin = Math.min(histogram.length - 1, Math.max(0, Math.floor((value - min) / (max - min || 1) * histogram.length))); histogram[bin]++; });
  return { stats: { min, max, mean, median: percentile(usable, 50), stdDev: Math.sqrt(variance), variance, p05: percentile(usable, 5), p25: percentile(usable, 25), p50: percentile(usable, 50), p75: percentile(usable, 75), p95: percentile(usable, 95), sum, pixelCount: values.length, validPixelCount: usable.length, nodataPixelCount: nodataCount }, histogram, binEdges: edges };
}

function bandIndex(params: RasterOperationParams, name: string, fallback: number, count: number) {
  const configured = params.bands?.[name];
  const index = configured == null ? fallback : configured > 0 ? configured - 1 : configured;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error("raster.missingBand"); return index;
}
function indexOperation(data: RasterData, params: RasterOperationParams, progress: RasterProgress): Float32Array {
  const n = data.width * data.height; const out = new Float32Array(n); const bands = data.bands;
  const red = params.operation === 'ndwi' ? undefined : bands[bandIndex(params, "red", 0, bands.length)]; const nir = bands[bandIndex(params, "nir", Math.min(3, bands.length - 1), bands.length)];
  const green = params.operation === "ndwi" ? bands[bandIndex(params, "green", 1, bands.length)] : undefined;
  const blue = params.operation === "evi" ? bands[bandIndex(params, "blue", 2, bands.length)] : undefined;
  const l = params.saviL ?? 0.5;
  for (let i = 0; i < n; i++) {
    const r = valueAt(red, i, data.nodata); const g = valueAt(green, i, data.nodata); const b = valueAt(blue, i, data.nodata); const nValue = valueAt(nir, i, data.nodata);
    if ((params.operation !== 'ndwi' && r == null) || nValue == null || (params.operation === "evi" && b == null) || (params.operation === "ndwi" && g == null)) { out[i] = data.nodata ?? NaN; continue; }
    const redValue = r ?? 0;
    const denominator = params.operation === "evi" ? nValue + 6 * redValue - 7.5 * (b ?? 0) + 1 : params.operation === "ndwi" ? (g ?? 0) + nValue : nValue + redValue + (params.operation === 'savi' ? l : 0);
    out[i] = Math.abs(denominator) < 1e-12 ? (data.nodata ?? NaN) : params.operation === "evi" ? 2.5 * (nValue - redValue) / denominator : params.operation === "ndwi" ? ((g ?? 0) - nValue) / denominator : params.operation === "savi" ? ((nValue - redValue) / denominator) * (1 + l) : (nValue - redValue) / denominator;
    if (i % Math.max(1, Math.floor(n / 20)) === 0) progress(i / n * 100, "Menghitung indeks");
  }
  return out;
}

function parseExpression(expression: string, names: string[]) {
  if (!expression || expression.length > 300 || /[^\w\s+\-*/().,]/.test(expression)) throw new Error("raster.invalidExpression");
  const tokens = expression.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[()+\-*/.,]/g) ?? []; if (tokens.join("") !== expression.replace(/\s/g, "")) throw new Error("raster.invalidExpression");
  const allowed = new Set([...names, "abs", "sqrt", "log", "exp", "min", "max", "pow"]); let position = 0;
  type Node = { kind: "number"; value: number } | { kind: "name"; name: string } | { kind: "unary"; op: "-"; value: Node } | { kind: "binary"; op: string; left: Node; right: Node } | { kind: "call"; name: string; args: Node[] };
  const peek = () => tokens[position]; const take = (expected?: string) => { const token = tokens[position++]; if (!token || (expected && token !== expected)) throw new Error("raster.invalidExpression"); return token; };
  const primary = (): Node => { const token = peek(); if (!token) throw new Error("raster.invalidExpression"); if (token === "(") { take("("); const value = additive(); take(")"); return value; } if (/^\d/.test(token)) { take(); return { kind: "number", value: Number(token) }; } if (/^[A-Za-z_]/.test(token) && allowed.has(token)) { take(); if (peek() !== "(") return { kind: "name", name: token }; take("("); const args: Node[] = []; if (peek() !== ")") { args.push(additive()); while (peek() === ",") { take(","); args.push(additive()); } } take(")"); if (!["abs", "sqrt", "log", "exp"].includes(token) && (args.length < 2 || args.length > 3)) throw new Error("raster.invalidExpression"); return { kind: "call", name: token, args }; } throw new Error("raster.invalidExpression"); };
  const unary = (): Node => peek() === "-" ? (take("-"), { kind: "unary", op: "-", value: unary() }) : primary();
  const multiplicative = (): Node => { let node = unary(); while (["*", "/"].includes(peek() ?? "")) { const op = take(); node = { kind: "binary", op, left: node, right: unary() }; } return node; };
  const additive = (): Node => { let node = multiplicative(); while (["+", "-"].includes(peek() ?? "")) { const op = take(); node = { kind: "binary", op, left: node, right: multiplicative() }; } return node; };
  const tree = additive(); if (position !== tokens.length) throw new Error("raster.invalidExpression");
  const evaluate = (node: Node, values: Record<string, number>): number => { if (node.kind === "number") return node.value; if (node.kind === "name") { const value = values[node.name]; if (!Number.isFinite(value)) throw new Error("raster.invalidExpression"); return value; } if (node.kind === "unary") return -evaluate(node.value, values); if (node.kind === "binary") { const left = evaluate(node.left, values); const right = evaluate(node.right, values); return node.op === "+" ? left + right : node.op === "-" ? left - right : node.op === "*" ? left * right : Math.abs(right) < 1e-12 ? NaN : left / right; } const args = node.args.map(arg => evaluate(arg, values)); return node.name === "abs" ? Math.abs(args[0]) : node.name === "sqrt" ? Math.sqrt(args[0]) : node.name === "log" ? Math.log(args[0]) : node.name === "exp" ? Math.exp(args[0]) : node.name === "min" ? Math.min(...args) : node.name === "max" ? Math.max(...args) : Math.pow(args[0], args[1]); };
  return (values: Record<string, number>) => evaluate(tree, values);
}
function bandMath(data: RasterData, params: RasterOperationParams, progress: RasterProgress) {
  const bandNames = Object.keys(params.bands ?? {}); const evaluator = parseExpression(params.expression ?? "", [...bandNames, ...bandNames.map(name => name.toUpperCase())]); const out = new Float32Array(data.width * data.height);
  for (let i = 0; i < out.length; i++) { const values: Record<string, number> = {}; Object.entries(params.bands ?? {}).forEach(([name, index]) => { const value = valueAt(data.bands[index > 0 ? index - 1 : index], i, data.nodata) ?? NaN; values[name] = value; values[name.toUpperCase()] = value; }); const result = Object.values(values).every(Number.isFinite) ? evaluator(values) : NaN; out[i] = Number.isFinite(result) ? result : (data.nodata ?? NaN); if (i % Math.max(1, Math.floor(out.length / 20)) === 0) progress(i / out.length * 100, "Menghitung band math"); }
  return out;
}
function clip(data: RasterData, geometry: NonNullable<RasterOperationParams["clipGeometry"]>) {
  const [west, south, east, north] = bboxOfGeometry(geometry);
  const bounds = data.source!.bounds!;
  const dx = (bounds[2] - bounds[0]) / data.width;
  const dy = (bounds[3] - bounds[1]) / data.height;
  const x0 = Math.max(0, Math.floor((west - bounds[0]) / dx));
  const x1 = Math.min(data.width, Math.ceil((east - bounds[0]) / dx));
  const y0 = Math.max(0, Math.floor((bounds[3] - north) / dy));
  const y1 = Math.min(data.height, Math.ceil((bounds[3] - south) / dy));
  if (x1 <= x0 || y1 <= y0) throw new Error("raster.aoiOutsideRaster");
  const width = x1 - x0; const height = y1 - y0;
  const bands = data.bands.map(source => {
    const target = new Float32Array(width * height).fill(data.nodata ?? NaN);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const lon = bounds[0] + (x + .5) * dx; const lat = bounds[3] - (y + .5) * dy;
      if (pointInGeometry(lon, lat, geometry)) target[(y-y0)*width+x-x0] = source[y*data.width+x];
    }
    return target;
  });
  const snapped = [bounds[0]+x0*dx, bounds[3]-y1*dy, bounds[0]+x1*dx, bounds[3]-y0*dy];
  const transform = [snapped[0], dx, 0, snapped[3], 0, -dy];
  return { ...data, width, height, bands, source: { ...data.source!, width, height, bounds: snapped, transform } };
}
function terrain(data: RasterData, params: RasterOperationParams, mode: "slope" | "aspect" | "hillshade") {
  const elevation = data.bands[0];
  const nodata = data.nodata ?? NaN;
  const out = new Float32Array(data.width * data.height).fill(nodata);
  const azimuth = (params.hillshadeAzimuth ?? 315) * Math.PI / 180;
  const altitude = (params.hillshadeAltitude ?? 45) * Math.PI / 180;
  const transform = data.source?.transform;
  const bounds = data.source?.bounds;
  const geographic = ["EPSG:4326", "CRS:84", "OGC:CRS84"].includes((data.source?.crs ?? "").toUpperCase());
  const pixelWidth = Math.abs(transform?.[1] ?? (bounds ? (bounds[2] - bounds[0]) / data.width : 0));
  const pixelHeight = Math.abs(transform?.[5] ?? (bounds ? (bounds[3] - bounds[1]) / data.height : 0));
  const explicitScale = params.scale;
  const radiansPerDegree = Math.PI / 180;
  const earthRadiusMetres = 6_378_137;
  const sample = (x: number, y: number) => elevation[y * data.width + x];

  // Horn's 3 x 3 kernel needs a complete neighborhood. Geographic rasters
  // store pixels in degrees, so convert their horizontal spacing to metres at
  // each row; using degrees as metres produces meaningless slope/aspect values.
  for (let y = 1; y < data.height - 1; y++) for (let x = 1; x < data.width - 1; x++) {
    const neighbors = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => sample(x + dx, y + dy)));
    if (neighbors.some(value => !valid(value, data.nodata))) continue;

    let dxMetres = explicitScale ?? pixelWidth;
    let dyMetres = explicitScale ?? pixelHeight;
    if (geographic && explicitScale == null) {
      const latitude = (bounds ? bounds[3] - (y + 0.5) * (bounds[3] - bounds[1]) / data.height : 0) * radiansPerDegree;
      const metresPerDegree = earthRadiusMetres * radiansPerDegree;
      dxMetres = pixelWidth * metresPerDegree * Math.max(Math.abs(Math.cos(latitude)), 1e-8);
      dyMetres = pixelHeight * metresPerDegree;
    }
    if (!Number.isFinite(dxMetres) || !Number.isFinite(dyMetres) || dxMetres <= 0 || dyMetres <= 0) continue;

    const left = sample(x - 1, y - 1) + 2 * sample(x - 1, y) + sample(x - 1, y + 1);
    const right = sample(x + 1, y - 1) + 2 * sample(x + 1, y) + sample(x + 1, y + 1);
    const top = sample(x - 1, y - 1) + 2 * sample(x, y - 1) + sample(x + 1, y - 1);
    const bottom = sample(x - 1, y + 1) + 2 * sample(x, y + 1) + sample(x + 1, y + 1);
    const dzdx = (right - left) / (8 * dxMetres);
    const dzdy = (bottom - top) / (8 * dyMetres);
    const slope = Math.atan(Math.hypot(dzdx, dzdy));
    const aspect = Math.atan2(dzdy, -dzdx);
    const index = y * data.width + x;
    out[index] = mode === "slope" ? slope * 180 / Math.PI : mode === "aspect" ? ((aspect * 180 / Math.PI) + 360) % 360 : clamp(255 * (Math.cos(altitude) * Math.cos(slope) + Math.sin(altitude) * Math.sin(slope) * Math.cos(azimuth - aspect)), 0, 255);
  }
  return out;
}
function reclassify(data: RasterData, params: RasterOperationParams) { const rules = params.reclassRules ?? []; const out = new Float32Array(data.width * data.height); data.bands[0].forEach((value, i) => { const rule = rules.find(item => value >= item.min && value < item.max); out[i] = rule ? rule.value : (data.nodata ?? NaN); }); return out; }
function stretch(data: RasterData, params: RasterOperationParams) { const band = data.bands[0]; const values = Array.from(band).filter(value => valid(value, data.nodata)); const min = params.stretchMin ?? percentile(values, params.stretchPercentileMin ?? 2) ?? 0; const max = params.stretchMax ?? percentile(values, params.stretchPercentileMax ?? 98) ?? 1; return Float32Array.from(band, value => valid(value, data.nodata) ? clamp((value - min) / (max - min || 1), 0, 1) : (data.nodata ?? NaN)); }

export function runRasterOperation(data: RasterData, params: RasterOperationParams, onProgress: RasterProgress = noop, after?: RasterData): RasterResult {
  validateOperation(data, params); onProgress(2, "Memvalidasi raster"); let working = data; let output: Float32Array; let legend: ReclassRule[] | undefined;
  if (["clip", "clip_stretch"].includes(params.operation)) { if (!params.clipGeometry) throw new Error("raster.invalidAoi"); working = clip(data, params.clipGeometry); }
  if (["ndvi", "evi", "ndwi", "savi"].includes(params.operation)) output = indexOperation(working, params, onProgress);
  else if (params.operation === "band_math") output = bandMath(working, params, onProgress);
  else if (["stretch", "clip_stretch"].includes(params.operation)) output = stretch(working, params);
  else if (params.operation === "reclassify") { output = reclassify(working, params); legend = params.reclassRules; }
  else if (["slope", "aspect", "hillshade"].includes(params.operation)) output = terrain(working, params, params.operation as "slope" | "aspect" | "hillshade");
  else if (params.operation === "change_detection") { if (after) validateRaster(after);
    const sameNumbers = (a?: number[], b?: number[]) => !a && !b || Boolean(a && b && a.length === b.length && a.every((n, i) => Number.isFinite(n) && Number.isFinite(b[i]) && Math.abs(n - b[i]) < 1e-9));
    const hasReferenceGrid = Boolean(working.source?.crs && (working.source?.bounds || working.source?.transform));
    const afterHasReferenceGrid = Boolean(after?.source?.crs && (after.source?.bounds || after.source?.transform));
    const sameGrid = after && hasReferenceGrid && afterHasReferenceGrid
      && after.width === working.width && after.height === working.height && after.bands.length === working.bands.length
      && after.source?.crs === working.source?.crs
      && after.source?.resolution === working.source?.resolution
      && sameNumbers(after.source?.bounds, working.source?.bounds)
      && sameNumbers(after.source?.transform, working.source?.transform); if (!sameGrid) throw new Error("raster.gridMismatch"); output = new Float32Array(working.bands[0].length); const before = working.bands[0]; const later = after!.bands[0]; output.forEach((_, i) => { const a = valueAt(before, i, working.nodata); const b = valueAt(later, i, after!.nodata); output[i] = a == null || b == null ? (working.nodata ?? NaN) : params.changeMode === "ratio" ? (Math.abs(a) < 1e-12 ? (working.nodata ?? NaN) : b / a) : params.changeMode === "threshold" ? (Math.abs(b - a) >= (params.threshold ?? 0) ? 1 : 0) : b - a; }); }
  else { output = working.bands[0]; }
  const result: RasterResult = { width: working.width, height: working.height, bands: [output], nodata: working.nodata, source: working.source, operation: params.operation, legend }; if (["histogram", "statistics", "zonal_statistics"].includes(params.operation)) { const summary = rasterStatistics(output, working.nodata); result.stats = summary.stats; result.histogram = summary.histogram; result.bins = summary.binEdges; } else { const summary = rasterStatistics(output, working.nodata); result.stats = summary.stats; result.histogram = summary.histogram; result.bins = summary.binEdges; }
  if (params.operation === "zonal_statistics" && params.clipGeometry) { const bounds = working.source?.bounds ?? [0, 0, working.width, working.height]; const selected: number[] = []; for (let y = 0; y < working.height; y++) for (let x = 0; x < working.width; x++) { const lon = bounds[0] + (x + 0.5) / working.width * (bounds[2] - bounds[0]); const lat = bounds[3] - (y + 0.5) / working.height * (bounds[3] - bounds[1]); if (pointInGeometry(lon, lat, params.clipGeometry)) selected.push(output[y * working.width + x]); } const summary = rasterStatistics(selected, working.nodata); result.stats = summary.stats; result.histogram = summary.histogram; result.bins = summary.binEdges; }
  onProgress(100, "Selesai"); return result;
}
