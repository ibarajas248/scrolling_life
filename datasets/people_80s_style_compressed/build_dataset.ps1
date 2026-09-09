$ErrorActionPreference = 'Stop'

$outDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$categories = @(
  'Category:1980s fashion',
  'Category:Male fashion in the 1980s',
  'Category:Female fashion in the 1980s',
  'Category:Fashion in 1980',
  'Category:Fashion in 1981',
  'Category:Fashion in 1982',
  'Category:Fashion in 1983',
  'Category:Fashion in 1984',
  'Category:Fashion in 1985',
  'Category:Fashion in 1986',
  'Category:Fashion in 1987',
  'Category:Fashion in 1988',
  'Category:Fashion in 1989'
)

$limitBytes = 50MB
$targetMaxSide = 640
$quality = 68L
$downloaded = @{}
$manifest = New-Object System.Collections.Generic.List[object]
$userAgent = 'Codex dataset builder for local art reference'

Add-Type -AssemblyName System.Drawing
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality,
  $quality
)

function Get-ApiJson([string]$url) {
  Invoke-RestMethod -Uri $url -Headers @{ 'User-Agent' = $userAgent }
}

function Get-SafeName([string]$name) {
  $safe = $name -replace '^File:', ''
  $safe = $safe -replace '[\\/:*?"<>|]', '_'
  if ($safe.Length -gt 90) {
    $safe = $safe.Substring(0, 90)
  }
  return $safe
}

$total = 0L

foreach ($cat in $categories) {
  $cmcontinue = $null

  do {
    $url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtitle=' +
      [uri]::EscapeDataString($cat) +
      '&gcmtype=file&gcmlimit=50&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=' +
      $targetMaxSide

    if ($cmcontinue) {
      $url += '&gcmcontinue=' + [uri]::EscapeDataString($cmcontinue)
    }

    $json = Get-ApiJson $url

    if ($json.query.pages) {
      foreach ($page in $json.query.pages.PSObject.Properties.Value) {
        if ($total -ge $limitBytes) { break }
        if ($downloaded.ContainsKey($page.title)) { continue }
        if (-not $page.imageinfo) { continue }

        $info = $page.imageinfo[0]
        if ($info.mime -notmatch '^image/') { continue }

        $srcUrl = if ($info.thumburl) { $info.thumburl } else { $info.url }
        $rawPath = Join-Path $env:TEMP ('codex_80s_' + [guid]::NewGuid().ToString() + '.img')
        $img = $null
        $bmp = $null
        $gfx = $null

        try {
          Invoke-WebRequest -Uri $srcUrl -OutFile $rawPath -Headers @{ 'User-Agent' = $userAgent } | Out-Null

          $img = [System.Drawing.Image]::FromFile($rawPath)
          $scale = [Math]::Min(1.0, $targetMaxSide / [Math]::Max($img.Width, $img.Height))
          $w = [Math]::Max(1, [int]($img.Width * $scale))
          $h = [Math]::Max(1, [int]($img.Height * $scale))

          $bmp = New-Object System.Drawing.Bitmap($w, $h)
          $gfx = [System.Drawing.Graphics]::FromImage($bmp)
          $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $gfx.Clear([System.Drawing.Color]::White)
          $gfx.DrawImage($img, 0, 0, $w, $h)

          $name = Get-SafeName $page.title
          $outPath = Join-Path $outDir (($manifest.Count + 1).ToString('0000') + '_' + [IO.Path]::GetFileNameWithoutExtension($name) + '.jpg')
          $bmp.Save($outPath, $jpegCodec, $encParams)

          $size = (Get-Item -LiteralPath $outPath).Length
          if (($total + $size) -gt $limitBytes) {
            Remove-Item -LiteralPath $outPath -Force
            break
          }

          $total += $size
          $downloaded[$page.title] = $true

          $license = $null
          $artist = $null
          if ($info.extmetadata) {
            if ($info.extmetadata.LicenseShortName) { $license = $info.extmetadata.LicenseShortName.Value }
            if ($info.extmetadata.Artist) { $artist = ($info.extmetadata.Artist.Value -replace '<[^>]+>', '') }
          }

          $manifest.Add([pscustomobject]@{
            file = [IO.Path]::GetFileName($outPath)
            source_title = $page.title
            source_page = 'https://commons.wikimedia.org/wiki/' + [uri]::EscapeDataString(($page.title -replace ' ', '_'))
            category = $cat
            license = $license
            artist = $artist
            bytes = $size
            width = $w
            height = $h
          }) | Out-Null
        } catch {
          Write-Warning ("Skipping " + $page.title + ": " + $_.Exception.Message)
        } finally {
          if ($gfx) { $gfx.Dispose() }
          if ($bmp) { $bmp.Dispose() }
          if ($img) { $img.Dispose() }
          if (Test-Path -LiteralPath $rawPath) { Remove-Item -LiteralPath $rawPath -Force }
        }
      }
    }

    if ($total -ge $limitBytes) { break }
    $cmcontinue = if ($json.continue) { $json.continue.gcmcontinue } else { $null }
  } while ($cmcontinue)

  if ($total -ge $limitBytes) { break }
}

$manifest | ConvertTo-Json -Depth 8 |
  Set-Content -LiteralPath (Join-Path $outDir 'manifest.json') -Encoding UTF8

@"
Dataset comprimido de referencias visuales de gente/moda anos 80.
Fuente: Wikimedia Commons API, categorias relacionadas con 1980s fashion.
Compresion: JPEG, lado maximo ${targetMaxSide}px, calidad ${quality}.
Limite solicitado: 50 MB.
Archivos de imagen: $($manifest.Count)
Tamano total imagenes: $([Math]::Round($total / 1MB, 2)) MB
"@ | Set-Content -LiteralPath (Join-Path $outDir 'README.txt') -Encoding UTF8

$allFiles = Get-ChildItem -LiteralPath $outDir -File
$sum = ($allFiles | Measure-Object Length -Sum).Sum
[pscustomobject]@{
  Path = $outDir
  Images = $manifest.Count
  Files = $allFiles.Count
  TotalMB = [Math]::Round($sum / 1MB, 2)
}
