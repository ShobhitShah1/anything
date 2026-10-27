param([switch]$NativeOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'
$webDirectory = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'public'
$canvas = '#0d0d0f'
function Write-Icon($Source, $Destination, $Size, $ContentSize, $Background, $Monochrome = $false, $Height = 0) {
    if ($Height -eq 0) { $Height = $Size }
    $inputImage = [System.Drawing.Image]::FromFile((Join-Path $assetDirectory $Source))
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
    try {
        $graphics.Clear($(if ($Background) { [System.Drawing.ColorTranslator]::FromHtml($Background) } else { [System.Drawing.Color]::Transparent }))
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
        if ($Monochrome) {
            $matrix = [System.Drawing.Imaging.ColorMatrix]::new()
            $matrix.Matrix00 = $matrix.Matrix11 = $matrix.Matrix22 = 0
            $matrix.Matrix40 = $matrix.Matrix41 = $matrix.Matrix42 = 1
            $attributes.SetColorMatrix($matrix)
        }
        $offset = [int](($Size - $ContentSize) / 2)
        $verticalOffset = [int](($Height - $ContentSize) / 2)
        $rect = [System.Drawing.Rectangle]::new($offset, $verticalOffset, $ContentSize, $ContentSize)
        $graphics.DrawImage($inputImage, $rect, 0, 0, $inputImage.Width, $inputImage.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
        $expectedAlpha = if ($Background) { 255 } else { 0 }
        $visibleSamples = 0
        for ($sampleY = 1; $sampleY -lt 8; $sampleY++) {
            for ($sampleX = 1; $sampleX -lt 8; $sampleX++) {
                if ($bitmap.GetPixel([int]($Size * $sampleX / 8), [int]($Height * $sampleY / 8)).A -gt 32) { $visibleSamples++ }
            }
        }
        if ($bitmap.GetPixel(0, 0).A -ne $expectedAlpha -or $visibleSamples -lt 3) {
            throw "Invalid icon transparency or empty centre: $Destination"
        }
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $attributes.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
        $inputImage.Dispose()
    }
}
# Selected monochrome a; retain its transparent openings and folded corner.
foreach ($name in @('icon.png', 'icon-ios-light.png', 'icon-ios-dark.png')) {
    Write-Icon 'app-icon-mark.png' (Join-Path $assetDirectory $name) 1024 1024 $canvas
}
# Keep adaptive foreground artwork within the launcher's central safe zone.
Write-Icon 'app-icon-mark.png' (Join-Path $assetDirectory 'icon-foreground.png') 1024 760 $null
Write-Icon 'app-icon-mark.png' (Join-Path $assetDirectory 'android-icon-monochrome.png') 1024 760 $null $true
Write-Icon 'app-icon-mark.png' (Join-Path $assetDirectory 'brand-mark.png') 512 512 $null
if ($NativeOnly) { Write-Output 'Generated selected app icons only; web and splash assets were not rewritten.'; return }
Write-Icon 'app-icon-mark.png' (Join-Path $webDirectory 'anything-mark.png') 512 512 $null
Write-Icon 'icon.png' (Join-Path $webDirectory 'anything-icon.png') 512 512 $canvas
Write-Icon 'icon.png' (Join-Path $webDirectory 'favicon-32.png') 32 32 $canvas
Write-Icon 'icon.png' (Join-Path $webDirectory 'favicon-64.png') 64 64 $canvas
Write-Icon 'icon.png' (Join-Path $webDirectory 'apple-touch-icon.png') 180 180 $canvas
$websiteAssets = Join-Path $webDirectory '../website/public/assets'
if (Test-Path -LiteralPath $websiteAssets) {
    Copy-Item -LiteralPath (Join-Path $webDirectory 'anything-mark.png') -Destination (Join-Path $websiteAssets 'mark.png')
    Copy-Item -LiteralPath (Join-Path $webDirectory 'anything-icon.png') -Destination (Join-Path $websiteAssets 'icon.png')
}
$splashBitmap = [System.Drawing.Bitmap]::new(1080, 2400, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$splashGraphics = [System.Drawing.Graphics]::FromImage($splashBitmap)
$launchMark = [System.Drawing.Image]::FromFile((Join-Path $assetDirectory 'app-icon-mark.png'))
try {
    $splashGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml($canvas))
    $splashGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $splashGraphics.DrawImage($launchMark, [System.Drawing.Rectangle]::new(390, 1050, 300, 300))
    $splashBitmap.Save((Join-Path $assetDirectory 'splash-art.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $splashGraphics.Dispose()
    $splashBitmap.Dispose()
    $launchMark.Dispose()
}
Copy-Item -LiteralPath (Join-Path $assetDirectory 'splash-art.png') -Destination (Join-Path $assetDirectory '../modules/anything-launch/android/src/main/res/drawable-nodpi/anything_launch_art.png')
Write-Output 'Generated neutral native/web icons and matching splash; alpha and content checks passed.'
