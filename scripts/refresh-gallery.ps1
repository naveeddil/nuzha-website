param(
  [string]$GalleryDirectory = "../dist/gallery-images",
  [string]$OutputFile = "../dist/gallery-data.js"
)

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$galleryPath = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory $GalleryDirectory))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory $OutputFile))
$allowedExtensions = @(".jpg", ".jpeg", ".png", ".webp", ".gif")

if (-not (Test-Path -LiteralPath $galleryPath -PathType Container)) {
  throw "Gallery directory not found: $galleryPath"
}

$items = Get-ChildItem -LiteralPath $galleryPath -File |
  Where-Object { $allowedExtensions -contains $_.Extension.ToLowerInvariant() } |
  Sort-Object Name |
  ForEach-Object {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $parts = $baseName -split "--", 2
    $category = if ($parts.Count -gt 1) { $parts[0].ToLowerInvariant() } else { "gallery" }
    $title = if ($parts.Count -gt 1) { $parts[1] } else { $parts[0] }
    $title = (Get-Culture).TextInfo.ToTitleCase(($title -replace "[-_]", " "))
    [ordered]@{
      src = "gallery-images/$($_.Name)"
      category = $category
      titleEn = $title
      titleAr = $title
    }
  }

$json = $items | ConvertTo-Json -Depth 4
$content = "window.NUZHA_GALLERY = $json;`n"
[System.IO.File]::WriteAllText($outputPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Gallery manifest updated with $($items.Count) image(s): $outputPath"
