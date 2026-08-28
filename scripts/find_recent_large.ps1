$cutoff = (Get-Date).AddMinutes(-45)
$bigFiles = Get-ChildItem 'C:\Users\CARLOS' -Recurse -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt $cutoff -and $_.Length -gt 500KB } |
  Sort-Object Length -Descending |
  Select-Object -First 40

foreach ($f in $bigFiles) {
  $mb = [math]::Round($f.Length / 1MB, 1)
  $time = $f.LastWriteTime.ToString("HH:mm:ss")
  Write-Host "$mb MB   $time   $($f.FullName)"
}

Write-Host ""
Write-Host "--- ORDNER mit den meisten neuen Dateien (letzte 45 Min) ---"
$recentDirs = Get-ChildItem 'C:\Users\CARLOS' -Recurse -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt $cutoff } |
  Group-Object DirectoryName |
  Sort-Object Count -Descending |
  Select-Object -First 15

foreach ($d in $recentDirs) {
  Write-Host "$($d.Count) Dateien   $($d.Name)"
}
