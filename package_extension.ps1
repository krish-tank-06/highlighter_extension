$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDirectory = Join-Path $projectRoot 'src'
$manifestPath = Join-Path $sourceDirectory 'manifest.json'
$releaseDirectory = Join-Path $projectRoot 'dist'

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Could not find the extension manifest at $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$archivePath = Join-Path $releaseDirectory ("Multi-Highlight-v{0}.zip" -f $manifest.version)

if (Test-Path -LiteralPath $archivePath) {
    throw "The release archive already exists: $archivePath"
}

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
Compress-Archive -Path (Join-Path $sourceDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal
Write-Output "Created $archivePath"
