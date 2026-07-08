Add-Type -AssemblyName System.Drawing

$src     = [System.Drawing.Image]::FromFile('c:\QueryArena\client\public\logo.png')
$srcW    = $src.Width
$srcH    = $src.Height

# Recortar 5% de margen blanco por cada lado
$margin  = [int]($srcW * 0.05)
$cropW   = $srcW - ($margin * 2)
$cropH   = $srcH - ($margin * 2)
$srcRect = New-Object System.Drawing.Rectangle($margin, $margin, $cropW, $cropH)

foreach ($size in @(64, 48, 32)) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $dstRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $out = "c:\QueryArena\client\public\favicon-${size}.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved $out"
}

$src.Dispose()
Write-Host "Done."
