# B_run_measurements.ps1
param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$OutDir  = ".\metrics_out",
  [int]$StreamSamplesPerPrompt = 5,
  [int]$HitCount = 30,
  [switch]$DoConcurrency
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Save-Snap ($snap, $name) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $path = Join-Path $OutDir "$name_$ts.json"
  $snap | ConvertTo-Json -Depth 6 | Set-Content $path
  Write-Host "Saved -> $path" -ForegroundColor Green
}

# Prompts
$short  = "hello"
$medium = "summarize the cpu-only constraint of PocketLLM in one sentence"
$long   = "explain the tradeoffs of using a local cache for LLM responses including consistency, staleness, and TTL considerations with an example"
$prompts = @($short, $medium, $long)

# Env snapshot (for reproducibility)
$envInfo = [ordered]@{}
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors
$mem  = Get-CimInstance Win32_ComputerSystem | Select-Object -First 1 TotalPhysicalMemory
$os   = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption, Version, OSArchitecture
$envInfo.CPU = $cpu
$envInfo.RAM = $mem
$envInfo.OS  = $os
$envInfo.Node = (node -v)
$envInfo.Npm  = (npm -v)
$envPath = Join-Path $OutDir "environment.json"
$envInfo | ConvertTo-Json -Depth 6 | Set-Content $envPath
Write-Host "Saved -> $envPath" -ForegroundColor Green

# Reset and sweep
Invoke-WebRequest "$BaseUrl/api/v1/admin/metrics/reset" -Method POST -Headers @{ "Content-Type"="application/json" } -Body "{}" | Out-Null
Invoke-WebRequest "$BaseUrl/api/v1/cache/sweep"        -Method POST -Headers @{ "Content-Type"="application/json" } -Body "{}" | Out-Null

# --- Single MISS ---
foreach ($p in $prompts) {
  Invoke-WebRequest "$BaseUrl/api/v1/generate" -Method POST `
    -Headers @{ "Content-Type"="application/json" } `
    -Body (@{ prompt = $p } | ConvertTo-Json) | Out-Null
}
$snap_miss = Invoke-RestMethod "$BaseUrl/api/v1/admin/metrics"; Save-Snap $snap_miss "single_miss"

# --- Single HIT (pure) ---
$hitPrompt = "THIS IS A PURE HIT TEST"
Invoke-WebRequest "$BaseUrl/api/v1/generate" -Method POST -Headers @{ "Content-Type"="application/json" } -Body (@{ prompt = $hitPrompt } | ConvertTo-Json) | Out-Null
Invoke-WebRequest "$BaseUrl/api/v1/admin/metrics/reset" -Method POST -Headers @{ "Content-Type"="application/json" } -Body "{}" | Out-Null
for ($i=0; $i -lt $HitCount; $i++) {
  Invoke-WebRequest "$BaseUrl/api/v1/generate" -Method POST `
    -Headers @{ "Content-Type"="application/json" } `
    -Body (@{ prompt = $hitPrompt } | ConvertTo-Json) | Out-Null
}
$snap_hit = Invoke-RestMethod "$BaseUrl/api/v1/admin/metrics"; Save-Snap $snap_hit "single_hit"

# --- Streaming ---
Invoke-WebRequest "$BaseUrl/api/v1/admin/metrics/reset" -Method POST -Headers @{ "Content-Type"="application/json" } -Body "{}" | Out-Null
foreach ($p in $prompts) {
  $q = [uri]::EscapeDataString($p)
  1..$StreamSamplesPerPrompt | ForEach-Object {
    Invoke-WebRequest "$BaseUrl/api/v1/stream?prompt=$q" -Method GET | Out-Null
  }
}
$snap_stream = Invoke-RestMethod "$BaseUrl/api/v1/admin/metrics"; Save-Snap $snap_stream "stream"

# --- Optional concurrency (10 users) ---
if ($DoConcurrency) {
  # Warm
  $concPrompt = "CONCURRENCY TEST PROMPT"
  Invoke-WebRequest "$BaseUrl/api/v1/generate" -Method POST -Headers @{ "Content-Type"="application/json" } -Body (@{ prompt = $concPrompt } | ConvertTo-Json) | Out-Null
  Invoke-WebRequest "$BaseUrl/api/v1/admin/metrics/reset" -Method POST -Headers @{ "Content-Type"="application/json" } -Body "{}" | Out-Null

  npx autocannon -c 10 -d 20 -m POST `
    --headers "content-type: application/json" `
    --body "{\"prompt\":\"$concPrompt\"}" `
    $BaseUrl/api/v1/generate

  $snap_conc = Invoke-RestMethod "$BaseUrl/api/v1/admin/metrics"; Save-Snap $snap_conc "concurrency"
}

# --- CSV summary for report ---
$rows = @()

$rows += [pscustomobject]@{
  Scenario = "Single (MISS)"
  p50 = $snap_miss.generate.p50
  p95 = $snap_miss.generate.p95
  p99 = $snap_miss.generate.p99
  Notes = "Cache swept prior to calls"
}
$rows += [pscustomobject]@{
  Scenario = "Single (HIT)"
  p50 = $snap_hit.generate.p50
  p95 = $snap_hit.generate.p95
  p99 = $snap_hit.generate.p99
  Notes = "Pure hits (warm+reset before loop)"
}
$rows += [pscustomobject]@{
  Scenario = "Stream TTFT"
  p50 = $snap_stream.stream.ttft_p50
  p95 = $snap_stream.stream.ttft_p95
  p99 = $snap_stream.stream.ttft_p99
  Notes = "Time to first SSE token"
}
$rows += [pscustomobject]@{
  Scenario = "Stream Total"
  p50 = $snap_stream.stream.total_p50
  p95 = $snap_stream.stream.total_p95
  p99 = $snap_stream.stream.total_p99
  Notes = "Full stream duration"
}

$csvPath = Join-Path $OutDir "nfr_summary.csv"
$rows | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host "Saved -> $csvPath" -ForegroundColor Green

Write-Host "`n=== Quick Summary (p95) ===" -ForegroundColor Cyan
"Single MISS p95:  $($snap_miss.generate.p95) ms"
"Single HIT  p95:  $($snap_hit.generate.p95) ms  (hitRate=$([math]::Round($snap_hit.cacheHitRate*100,2))%)"
"Stream TTFT p95:  $($snap_stream.stream.ttft_p95) ms"
"Stream total p95: $($snap_stream.stream.total_p95) ms"
