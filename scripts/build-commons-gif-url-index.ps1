param(
    [string]$OutCsv = "",
    [int]$MaxItems = 5000,
    [string]$Category = "Category:Animated_GIF_files",
    [int]$ThumbWidth = 260
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($OutCsv)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
    $OutCsv = Join-Path $ProjectRoot "assets\data\commons_gif_index.csv"
}

$ApiUrl = "https://commons.wikimedia.org/w/api.php"
$UserAgent = "CodexGifIndexer/1.0 (local Wikimedia Commons URL index; https://openai.com/)"
$AcceptedLicensePatterns = @(
    "^Public domain$",
    "^CC0",
    "^CC BY\b",
    "^CC BY-SA\b",
    "^CC-BY\b",
    "^CC-BY-SA\b",
    "^GFDL",
    "^FAL",
    "^Free Art"
)

function Get-MetadataValue {
    param(
        [object]$Metadata,
        [string]$Name
    )

    if ($null -eq $Metadata) {
        return ""
    }

    $Property = $Metadata.PSObject.Properties[$Name]
    if ($null -eq $Property -or $null -eq $Property.Value) {
        return ""
    }

    $ValueProperty = $Property.Value.PSObject.Properties["value"]
    if ($null -eq $ValueProperty -or $null -eq $ValueProperty.Value) {
        return ""
    }

    return [string]$ValueProperty.Value
}

function ConvertTo-PlainText {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    $WithoutTags = [regex]::Replace($Value, "<[^>]+>", " ")
    $Decoded = [System.Net.WebUtility]::HtmlDecode($WithoutTags)
    return ([regex]::Replace($Decoded, "\s+", " ")).Trim()
}

function ConvertTo-SafeFileName {
    param([string]$Title)

    $Name = $Title -replace "^File:", ""
    $Name = [regex]::Replace($Name, "[^\x20-\x7E]", "_")
    $Name = [regex]::Replace($Name, "[\\/:*?""<>|]", "_")
    $Name = [regex]::Replace($Name, "\s+", "_").Trim("_")

    if ([string]::IsNullOrWhiteSpace($Name)) {
        return "commons_gif.gif"
    }

    return $Name
}

function Test-FreeLicense {
    param([string]$LicenseShortName)

    foreach ($Pattern in $AcceptedLicensePatterns) {
        if ($LicenseShortName -match $Pattern) {
            return $true
        }
    }

    return $false
}

function Get-CommonsPageUrl {
    param(
        [string]$Title,
        [string]$FallbackUrl
    )

    if (-not [string]::IsNullOrWhiteSpace($FallbackUrl)) {
        return $FallbackUrl
    }

    $WikiTitle = $Title.Replace(" ", "_")
    return "https://commons.wikimedia.org/wiki/$([uri]::EscapeDataString($WikiTitle))"
}

function Invoke-CommonsQuery {
    param([hashtable]$Query)

    $Attempt = 0
    $MaxAttempts = 5

    while ($Attempt -lt $MaxAttempts) {
        try {
            return Invoke-RestMethod -Method Get -Uri $ApiUrl -Body $Query -UserAgent $UserAgent -Headers @{ Accept = "application/json" }
        }
        catch {
            $Attempt++
            $StatusCode = $null
            if ($null -ne $_.Exception.Response) {
                $StatusCode = [int]$_.Exception.Response.StatusCode
            }

            if (($StatusCode -eq 429 -or $StatusCode -eq 503) -and $Attempt -lt $MaxAttempts) {
                $DelaySeconds = [math]::Min(90, [math]::Pow(2, $Attempt) * 6)
                Write-Warning ("Commons API returned {0}. Waiting {1} seconds before retry {2}/{3}." -f $StatusCode, $DelaySeconds, ($Attempt + 1), $MaxAttempts)
                Start-Sleep -Seconds $DelaySeconds
                continue
            }

            throw
        }
    }
}

$OutDir = Split-Path -Parent $OutCsv
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Rows = New-Object System.Collections.Generic.List[object]
$SeenOriginalUrls = @{}
$ContinueParams = @{}
$RequestCount = 0

while ($Rows.Count -lt $MaxItems -and $RequestCount -lt 2000) {
    $RequestCount++

    $Query = @{
        action = "query"
        generator = "categorymembers"
        gcmtitle = $Category
        gcmtype = "file"
        gcmlimit = "50"
        prop = "imageinfo"
        iiprop = "url|size|mime|extmetadata"
        iiurlwidth = [string]$ThumbWidth
        format = "json"
    }

    foreach ($Key in $ContinueParams.Keys) {
        $Query[$Key] = $ContinueParams[$Key]
    }

    $Response = Invoke-CommonsQuery -Query $Query

    if ($null -eq $Response.query -or $null -eq $Response.query.pages) {
        break
    }

    $Pages = @($Response.query.pages.PSObject.Properties.Value | Sort-Object title)
    foreach ($Page in $Pages) {
        if ($Rows.Count -ge $MaxItems) {
            break
        }

        $ImageInfo = @($Page.imageinfo)[0]
        if ($null -eq $ImageInfo -or $ImageInfo.mime -ne "image/gif") {
            continue
        }

        $OriginalUrl = [string]$ImageInfo.url
        if ([string]::IsNullOrWhiteSpace($OriginalUrl) -or $SeenOriginalUrls.ContainsKey($OriginalUrl)) {
            continue
        }

        $License = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "LicenseShortName")
        if (-not (Test-FreeLicense $License)) {
            continue
        }

        $PreviewUrl = [string]$ImageInfo.thumburl
        if ([string]::IsNullOrWhiteSpace($PreviewUrl)) {
            $PreviewUrl = $OriginalUrl
        }

        $SeenOriginalUrls[$OriginalUrl] = $true
        $Rows.Add([pscustomobject]@{
            index = $Rows.Count + 1
            title = [string]$Page.title
            file_name = ConvertTo-SafeFileName $Page.title
            size_bytes = [int64]$ImageInfo.size
            size_mb = [math]::Round(([int64]$ImageInfo.size) / 1MB, 3)
            width = [int]$ImageInfo.width
            height = [int]$ImageInfo.height
            thumb_width = if ($null -ne $ImageInfo.thumbwidth) { [int]$ImageInfo.thumbwidth } else { 0 }
            thumb_height = if ($null -ne $ImageInfo.thumbheight) { [int]$ImageInfo.thumbheight } else { 0 }
            preview_url = $PreviewUrl
            original_url = $OriginalUrl
            source_page = Get-CommonsPageUrl $Page.title ([string]$ImageInfo.descriptionurl)
            license = $License
            license_url = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "LicenseUrl")
            artist = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "Artist")
            credit = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "Credit")
        }) | Out-Null
    }

    if ($Rows.Count % 500 -lt 50) {
        Write-Host ("Indexed {0}/{1} GIF URLs..." -f $Rows.Count, $MaxItems)
    }

    $ContinueObject = $Response.PSObject.Properties["continue"]
    if ($null -eq $ContinueObject -or $null -eq $ContinueObject.Value) {
        break
    }

    $ContinueParams = @{}
    foreach ($Property in $ContinueObject.Value.PSObject.Properties) {
        $ContinueParams[$Property.Name] = $Property.Value
    }

    Start-Sleep -Milliseconds 250
}

$Rows | Export-Csv -Path $OutCsv -NoTypeInformation -Encoding UTF8

$SummaryPath = Join-Path $OutDir "commons_gif_index_README.md"
$TotalBytes = [int64](($Rows | Measure-Object -Property size_bytes -Sum).Sum)
$Readme = @(
    "# Indice de URLs GIF libres",
    "",
    "Generado el: $((Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz"))",
    "Origen: https://commons.wikimedia.org/wiki/$([uri]::EscapeDataString($Category.Replace(" ", "_")))",
    "Filas: $($Rows.Count)",
    "Peso remoto total indexado: $([math]::Round($TotalBytes / 1MB, 2)) MB",
    "Miniatura solicitada: $ThumbWidth px",
    "",
    "Este archivo solo indexa URLs y metadatos. No descarga los GIFs.",
    "Las licencias filtradas son dominio publico, CC0, CC BY, CC BY-SA, GFDL y Free Art License.",
    "Para publicar o reutilizar el material, revisa las columnas license, artist, license_url y source_page."
)
Set-Content -Path $SummaryPath -Value $Readme -Encoding UTF8

Write-Host ""
Write-Host "Done."
Write-Host ("CSV: {0}" -f (Resolve-Path -LiteralPath $OutCsv))
Write-Host ("Rows: {0}" -f $Rows.Count)
Write-Host ("Remote indexed size: {0:N2} MB" -f ($TotalBytes / 1MB))
