$ErrorActionPreference = 'Stop'
$releaseRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseVersion = (Get-Content -LiteralPath (Join-Path $releaseRoot 'package.json') -Raw | ConvertFrom-Json).version
$releaseOutput = Join-Path $releaseRoot 'artifacts/releases'
New-Item -ItemType Directory -Path $releaseOutput -Force | Out-Null
$releaseStage = Join-Path $releaseOutput ('stage-' + [guid]::NewGuid().ToString('N'))
$releaseFolder = Join-Path $releaseStage 'grocery-ecommerce-starter'
New-Item -ItemType Directory -Path $releaseFolder | Out-Null
$releaseAllowed = @('src','server','public','tests','scripts','docs','deploy','AGENTS.md','README.md','package.json','package-lock.json','tsconfig.json','next.config.ts','next-env.d.ts','.env.example','.gitignore','.dockerignore','Dockerfile','COMMERCIAL-LICENSE-DRAFT.md','CHANGELOG.md')
foreach ($releaseEntry in $releaseAllowed) {
  $releaseSource = Join-Path $releaseRoot $releaseEntry
  if (!(Test-Path -LiteralPath $releaseSource)) { throw "Missing release source: $releaseEntry" }
  Copy-Item -LiteralPath $releaseSource -Destination (Join-Path $releaseFolder $releaseEntry) -Recurse
}
$releaseFiles = Get-ChildItem -LiteralPath $releaseFolder -Recurse -File
foreach ($releaseFile in $releaseFiles) {
  $releaseRelative = [IO.Path]::GetRelativePath($releaseFolder,$releaseFile.FullName).Replace('\','/')
  if ($releaseRelative -match '(^|/)(node_modules|\.next|\.git|\.data|artifacts|test-results)(/|$)' -or ($releaseFile.Name -like '.env*' -and $releaseFile.Name -ne '.env.example')) { throw "Forbidden release file: $releaseRelative" }
}
$releaseManifest = @($releaseFiles | Sort-Object FullName | ForEach-Object { @{path=[IO.Path]::GetRelativePath($releaseFolder,$_.FullName).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();bytes=$_.Length} })
$releaseManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $releaseFolder 'release-manifest.json') -Encoding utf8
$releaseZip = Join-Path $releaseOutput "grocery-ecommerce-starter-$releaseVersion.zip"
Compress-Archive -LiteralPath $releaseFolder -DestinationPath $releaseZip -Force
Get-FileHash -LiteralPath $releaseZip -Algorithm SHA256 | Select-Object Path,Hash
# Staging sources are retained for inspection; they are never recursively packaged.
