const LIMIT = 5000;

function push(arr: number[], v: number) {
  arr.push(v);
  if (arr.length > LIMIT) arr.shift();
}

function q(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.max(0, Math.min(s.length - 1, Math.ceil(p * s.length) - 1));
  return s[i];
}

const genDur: number[] = [];   // ms
let genCount = 0, genHit = 0, genMiss = 0;

const streamTTFT: number[] = []; // ms
const streamDur: number[] = [];  // ms
let streamCount = 0;

export function recGenerate(durationMs: number, cacheHit: boolean) {
  genCount++;
  cacheHit ? genHit++ : genMiss++;
  push(genDur, durationMs);
}

export function recStream(ttftMs: number, totalMs: number) {
  streamCount++;
  push(streamTTFT, ttftMs);
  push(streamDur, totalMs);
}

export function snapshot() {
  const gen = {
    count: genCount,
    cacheHit: genHit,
    cacheMiss: genMiss,
    p50: q(genDur, 0.50),
    p95: q(genDur, 0.95),
    p99: q(genDur, 0.99),
  };
  const stream = {
    count: streamCount,
    ttft_p50: q(streamTTFT, 0.50),
    ttft_p95: q(streamTTFT, 0.95),
    ttft_p99: q(streamTTFT, 0.99),
    total_p50: q(streamDur, 0.50),
    total_p95: q(streamDur, 0.95),
    total_p99: q(streamDur, 0.99),
  };
  const cacheHitRate = gen.count ? (gen.cacheHit / gen.count) : 0;
  return { generate: gen, stream, cacheHitRate };
}

export function reset() {
  genDur.length = 0; streamTTFT.length = 0; streamDur.length = 0;
  genCount = genHit = genMiss = streamCount = 0;
}
