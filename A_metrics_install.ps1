# A_metrics_install.ps1
# This script writes the metrics instrumentation and patches generate/admin routes.

param(
  # Change if your backend path differs
  [string]$BackendRoot = (Join-Path $PSScriptRoot "backend")
)

Write-Host "Backend root: $BackendRoot" -ForegroundColor Cyan

$svcDir = Join-Path $BackendRoot "src\services"
$routesDir = Join-Path $BackendRoot "src\routes"

if (-not (Test-Path $svcDir))    { New-Item -ItemType Directory -Force -Path $svcDir    | Out-Null }
if (-not (Test-Path $routesDir)) { New-Item -ItemType Directory -Force -Path $routesDir | Out-Null }

# --- metrics.ts ---
$metricsTs = @'
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
'@

Set-Content -Path (Join-Path $svcDir "metrics.ts") -Value $metricsTs -Encoding UTF8
Write-Host "Wrote services\metrics.ts" -ForegroundColor Green

# --- routes\generate.ts (overwrite with instrumented version) ---
$genPath = Join-Path $routesDir "generate.ts"
if (Test-Path $genPath) { Copy-Item $genPath "$genPath.bak" -Force; Write-Host "Backed up routes\generate.ts -> generate.ts.bak" -ForegroundColor Yellow }

$generateTs = @'
import { FastifyInstance } from "fastify";
import crypto from "crypto";
import * as cache from "../services/cache";
import { generateOnce, generateStream } from "../services/modelRunner";
import { recGenerate, recStream } from "../services/metrics";

export default async function (f: FastifyInstance) {
  f.post("/api/v1/generate", async (req, res) => {
    const started = process.hrtime.bigint();

    const { prompt, settings } = (req.body as any);
    const key = crypto.createHash("sha1").update(JSON.stringify({ prompt, settings })).digest("hex");
    const hit = cache.get(key) as { value: string } | undefined;

    if (hit?.value) {
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
      recGenerate(elapsed, true);
      return { completion: JSON.parse(hit.value), cacheHit: true };
    }

    const completion = await generateOnce(prompt);
    const body = { text: completion };
    cache.put(key, JSON.stringify(body));

    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    recGenerate(elapsed, false);
    return { completion: body, cacheHit: false };
  });

  f.get("/api/v1/stream", async (req, res) => {
    const prompt = (req.query as any).prompt || "";
    const started = process.hrtime.bigint();
    let firstTokenAt: bigint | null = null;

    res.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    for await (const token of generateStream(prompt)) {
      if (!firstTokenAt) firstTokenAt = process.hrtime.bigint();
      res.raw.write(`data: ${token}\n\n`);
    }
    res.raw.end();

    const end = process.hrtime.bigint();
    const ttftMs = firstTokenAt ? Number(firstTokenAt - started) / 1e6 : Number(end - started) / 1e6;
    const totalMs = Number(end - started) / 1e6;
    recStream(ttftMs, totalMs);
  });
}
'@

Set-Content -Path $genPath -Value $generateTs -Encoding UTF8
Write-Host "Wrote routes\generate.ts (instrumented)" -ForegroundColor Green

# --- routes\admin.ts (overwrite with metrics endpoints) ---
$adminPath = Join-Path $routesDir "admin.ts"
if (Test-Path $adminPath) { Copy-Item $adminPath "$adminPath.bak" -Force; Write-Host "Backed up routes\admin.ts -> admin.ts.bak" -ForegroundColor Yellow }

$adminTs = @'
import { FastifyInstance } from "fastify";
import { snapshot, reset } from "../services/metrics";

export default async function (f: FastifyInstance) {
  f.get("/api/v1/admin/health", () => ({ status: "ok", time: Date.now() }));
  f.get("/api/v1/admin/metrics", () => snapshot());
  f.post("/api/v1/admin/metrics/reset", () => (reset(), { ok: true }));
}
'@

Set-Content -Path $adminPath -Value $adminTs -Encoding UTF8
Write-Host "Wrote routes\admin.ts (metrics API)" -ForegroundColor Green

Write-Host "`n✅ Files written. Now STOP and RESTART your backend: `npm run dev` in $BackendRoot" -ForegroundColor Cyan
