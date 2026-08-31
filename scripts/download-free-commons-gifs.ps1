param(
    [string]$OutDir = "",
    [int]$MaxMegabytes = 50,
    [string]$Category = "Category:Animated_GIF_files"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
    $OutDir = Join-Path $ProjectRoot "assets\gifs_commons_libres"
}

$MaxBytes = [int64]$MaxMegabytes * 1MB
$ApiUrl = "https://commons.wikimedia.org/w/api.php"
$UserAgent = "CodexGifDownloader/1.0 (local Wikimedia Commons asset download; https://openai.com/)"

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
        $Name = "commons_gif.gif"
    }

    if (-not $Name.ToLowerInvariant().EndsWith(".gif")) {
        $Name = "$Name.gif"
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
    param([string]$Title)

    $WikiTitle = $Title.Replace(" ", "_")
    return "https://commons.wikimedia.org/wiki/$([uri]::EscapeDataString($WikiTitle))"
}

function Save-RemoteFile {
    param(
        [string]$Uri,
        [string]$OutPath
    )

    $Attempt = 0
    $MaxAttempts = 4

    while ($Attempt -lt $MaxAttempts) {
        try {
            Invoke-WebRequest -Uri $Uri -OutFile $OutPath -UserAgent $UserAgent -Headers @{ Accept = "image/gif,*/*" }
            return
        }
        catch {
            $Attempt++
            $StatusCode = $null
            if ($null -ne $_.Exception.Response) {
                $StatusCode = [int]$_.Exception.Response.StatusCode
            }

            if (($StatusCode -eq 429 -or $StatusCode -eq 503) -and $Attempt -lt $MaxAttempts) {
                $DelaySeconds = [math]::Min(60, [math]::Pow(2, $Attempt) * 5)
                Write-Warning ("Remote server returned {0}. Waiting {1} seconds before retry {2}/{3}." -f $StatusCode, $DelaySeconds, ($Attempt + 1), $MaxAttempts)
                Start-Sleep -Seconds $DelaySeconds
                continue
            }

            throw
        }
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Downloaded = New-Object System.Collections.Generic.List[object]
$SeenUrls = @{}
$TotalBytes = [int64]0
$ContinueParams = @{}
$RequestCount = 0

while ($TotalBytes -lt $MaxBytes -and $RequestCount -lt 40) {
    $RequestCount++

    $Query = @{
        action = "query"
        generator = "categorymembers"
        gcmtitle = $Category
        gcmtype = "file"
        gcmlimit = "50"
        prop = "imageinfo"
        iiprop = "url|size|mime|extmetadata"
        format = "json"
    }

    foreach ($Key in $ContinueParams.Keys) {
        $Query[$Key] = $ContinueParams[$Key]
    }

    $Response = Invoke-RestMethod -Method Get -Uri $ApiUrl -Body $Query -UserAgent $UserAgent -Headers @{ Accept = "application/json" }

    if ($null -eq $Response.query -or $null -eq $Response.query.pages) {
        break
    }

    $Pages = @($Response.query.pages.PSObject.Properties.Value | Sort-Object title)
    foreach ($Page in $Pages) {
        if ($TotalBytes -ge $MaxBytes) {
            break
        }

        $ImageInfo = @($Page.imageinfo)[0]
        if ($null -eq $ImageInfo -or $ImageInfo.mime -ne "image/gif") {
            continue
        }

        $SizeBytes = [int64]$ImageInfo.size
        if ($SizeBytes -le 0 -or $SizeBytes -gt ($MaxBytes - $TotalBytes)) {
            continue
        }

        if ($SeenUrls.ContainsKey($ImageInfo.url)) {
            continue
        }

        $License = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "LicenseShortName")
        if (-not (Test-FreeLicense $License)) {
            continue
        }

        $Index = $Downloaded.Count + 1
        $FileName = "{0:D2}_{1}" -f $Index, (ConvertTo-SafeFileName $Page.title)
        $OutPath = Join-Path $OutDir $FileName

        Save-RemoteFile -Uri $ImageInfo.url -OutPath $OutPath
        $ActualSize = [int64](Get-Item -LiteralPath $OutPath).Length
        $TotalBytes += $ActualSize
        $SeenUrls[$ImageInfo.url] = $true

        $Downloaded.Add([pscustomobject]@{
            file_name = $FileName
            size_bytes = $ActualSize
            size_mb = [math]::Round($ActualSize / 1MB, 2)
            title = [string]$Page.title
            source_page = Get-CommonsPageUrl $Page.title
            original_url = [string]$ImageInfo.url
            license = $License
            license_url = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "LicenseUrl")
            artist = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "Artist")
            credit = ConvertTo-PlainText (Get-MetadataValue $ImageInfo.extmetadata "Credit")
        }) | Out-Null

        Write-Host ("Downloaded {0} ({1:N2} MB). Total: {2:N2} MB" -f $FileName, ($ActualSize / 1MB), ($TotalBytes / 1MB))
        Start-Sleep -Milliseconds 1500
    }

    if ($TotalBytes -ge $MaxBytes) {
        break
    }

    $ContinueObject = $Response.PSObject.Properties["continue"]
    if ($null -eq $ContinueObject -or $null -eq $ContinueObject.Value) {
        break
    }

    $ContinueParams = @{}
    foreach ($Property in $ContinueObject.Value.PSObject.Properties) {
        $ContinueParams[$Property.Name] = $Property.Value
    }
}

$ManifestPath = Join-Path $OutDir "manifest.csv"
$Downloaded | Export-Csv -Path $ManifestPath -NoTypeInformation -Encoding UTF8

$ReadmePath = Join-Path $OutDir "README.md"
$Readme = @(
    "# GIFs libres de Wikimedia Commons",
    "",
    "Descargado el: $((Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz"))",
    "Origen: https://commons.wikimedia.org/wiki/$([uri]::EscapeDataString($Category.Replace(" ", "_")))",
    "Limite solicitado: $MaxMegabytes MB",
    "Total descargado: $([math]::Round($TotalBytes / 1MB, 2)) MB",
    "Cantidad de GIFs: $($Downloaded.Count)",
    "",
    "Se aceptaron licencias libres como dominio publico, CC0, CC BY, CC BY-SA, GFDL y Free Art License.",
    "Revisa manifest.csv antes de publicar: las licencias con atribucion suelen requerir mencionar autor, licencia y enlace a la fuente.",
    "",
    "Archivos:",
    ""
)

foreach ($Item in $Downloaded) {
    $Readme += "- $($Item.file_name) - $($Item.size_mb) MB - $($Item.license) - $($Item.source_page)"
}

Set-Content -Path $ReadmePath -Value $Readme -Encoding UTF8

Write-Host ""
Write-Host "Done."
Write-Host ("Folder: {0}" -f (Resolve-Path -LiteralPath $OutDir))
Write-Host ("GIFs: {0}" -f $Downloaded.Count)
Write-Host ("Total: {0:N2} MB" -f ($TotalBytes / 1MB))
Write-Host ("Manifest: {0}" -f $ManifestPath)
