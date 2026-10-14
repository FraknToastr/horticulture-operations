param([string]$Suite = 'workspace-readiness', [string]$Output = 'edge', [string]$Only = '')
$ErrorActionPreference = 'Stop'
$env:ELECTRON_RUN_AS_NODE = '1'
$env:READINESS_OUTPUT = "test-results/nsa-demo-readiness/$Output"
$env:READINESS_ONLY = $Only
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$runtime = Join-Path $env:TEMP 'nsa-readiness-runner-20261014'
New-Item -ItemType Directory -Force "$runtime\node_modules\@playwright", "$runtime\tests\readiness" | Out-Null
foreach ($package in @('playwright', 'playwright-core', '@playwright\test')) {
  $dest = Join-Path "$runtime\node_modules" $package
  if (!(Test-Path $dest)) { Copy-Item -Recurse "$repo\node_modules\$package" $dest }
}
if (!(Test-Path "$runtime\src")) { Copy-Item -Recurse "$repo\src" "$runtime\src" }
if ($Suite -eq 'navigation-revision-fix' -or $Suite -eq 'quote-file-edge') {
  # This suite serves local source; always refresh it, never test a stale copy.
  Copy-Item -Recurse -Force "$repo\src\*" "$runtime\src"
}
if ($Suite -eq 'quote-file-edge') {
  New-Item -ItemType Directory -Force "$runtime\tests\browser" | Out-Null
  Copy-Item "$repo\tests\browser\quote-first-interaction.spec.js", "$repo\tests\browser\test-helper.cjs" "$runtime\tests\browser" -Force
}
if (!(Test-Path "$runtime\tests\fixtures")) { Copy-Item -Recurse "$repo\tests\fixtures" "$runtime\tests\fixtures" }
Copy-Item "$repo\tests\readiness\*.cjs" "$runtime\tests\readiness" -Force
if ($Suite -eq 'verify-report') {
  New-Item -ItemType Directory -Force "$runtime\report-input" | Out-Null
  $reportSource = "$repo\test-results\nsa-demo-readiness"
  if (!(Test-Path "$reportSource\readiness-data.json")) { $reportSource = "$repo\docs\readiness" }
  Copy-Item "$reportSource\nsa-demo-readiness-report.*", "$reportSource\readiness-data.json" "$runtime\report-input" -Force
}
Set-Location $runtime
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" "$runtime\tests\readiness\$Suite.cjs" | Out-Host
New-Item -ItemType Directory -Force "$repo\test-results\nsa-demo-readiness\$Output" | Out-Null
Copy-Item -Recurse -Force "$runtime\test-results\nsa-demo-readiness\$Output\*" "$repo\test-results\nsa-demo-readiness\$Output"
exit $LASTEXITCODE
