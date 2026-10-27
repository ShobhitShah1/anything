$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolRoot = Join-Path $projectRoot '.tools/ninja'
New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
$release = Invoke-RestMethod 'https://api.github.com/repos/ninja-build/ninja/releases/tags/v1.13.2'
$asset = $release.assets | Where-Object { $_.name -eq 'ninja-win.zip' } | Select-Object -First 1
if (-not $asset -or $asset.browser_download_url -notlike 'https://github.com/ninja-build/ninja/releases/download/v1.13.2/*') { throw 'Official Ninja release asset was not found.' }
$archive = Join-Path $toolRoot 'ninja-win.zip'
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive
if ($asset.digest -and $asset.digest.StartsWith('sha256:')) {
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $asset.digest.Substring(7)) { throw 'Ninja download checksum did not match.' }
}
Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot -Force
$executable = Join-Path $toolRoot 'ninja.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Ninja executable was not extracted.' }
$version = & $executable --version
if ($LASTEXITCODE -ne 0 -or $version -ne '1.13.2') { throw 'Ninja version check failed.' }
Write-Output "Installed project-local Ninja $version. The Android SDK was not changed."
