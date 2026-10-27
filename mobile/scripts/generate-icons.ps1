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
        if ($bitmap.GetPixel(0, 0).A -ne $expectedAlpha -or $bitmap.GetPixel([int]($Size / 2), [int]($Height / 2)).A -eq 0) {
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
# Use the same neutral mascot and charcoal canvas on every platform.
foreach ($name in @('icon-source.png', 'icon.png', 'icon-ios-light.png', 'icon-ios-dark.png')) {
    Write-Icon 'icon-mascot.png' (Join-Path $assetDirectory $name) 1024 940 $canvas
}
# Keep adaptive foreground artwork within the launcher's central safe zone.
Write-Icon 'icon-mascot.png' (Join-Path $assetDirectory 'icon-foreground.png') 1024 720 $null
Write-Icon 'icon-mascot.png' (Join-Path $assetDirectory 'android-icon-monochrome.png') 1024 720 $null $true
Write-Icon 'icon-source.png' (Join-Path $assetDirectory 'favicon.png') 64 64 $canvas
Write-Icon 'icon-mascot.png' (Join-Path $webDirectory 'anything-mascot.png') 256 256 $null
Write-Icon 'icon-source.png' (Join-Path $webDirectory 'anything-icon.png') 512 512 $canvas
Write-Icon 'icon-source.png' (Join-Path $webDirectory 'favicon-32.png') 32 32 $canvas
Write-Icon 'icon-source.png' (Join-Path $webDirectory 'favicon-64.png') 64 64 $canvas
Write-Icon 'icon-source.png' (Join-Path $webDirectory 'apple-touch-icon.png') 180 180 $canvas
Write-Icon 'icon-mascot.png' (Join-Path $assetDirectory 'splash-art.png') 1080 420 $canvas $false 2400
Copy-Item -LiteralPath (Join-Path $assetDirectory 'splash-art.png') -Destination (Join-Path $assetDirectory '../modules/anything-launch/android/src/main/res/drawable-nodpi/anything_launch_art.png')
Write-Output 'Generated neutral native/web icons and matching splash; alpha and content checks passed.'
