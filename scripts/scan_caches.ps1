$dirs = @(
  'C:\Users\CARLOS\AppData\Local\Temp',
  'C:\Users\CARLOS\AppData\Local\npm-cache',
  'C:\Users\CARLOS\AppData\Roaming\npm-cache',
  'C:\Users\CARLOS\.npm',
  'C:\Users\CARLOS\.cache',
  'C:\Users\CARLOS\.gemini',
  'C:\Users\CARLOS\.commandcode',
  'C:\Users\CARLOS\AppData\Local\Google\Chrome\User Data\Default\Cache',
  'C:\Users\CARLOS\AppData\Local\BraveSoftware\Brave-Browser\User Data\Default\Cache',
  'C:\Users\CARLOS\AppData\Local\Pip\cache'
)

foreach ($d in $dirs) {
  if (Test-Path $d) {
    $bytes = (Get-ChildItem $d -Recurse -Force -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($bytes) {
      $gb = [math]::Round($bytes / 1GB, 2)
      Write-Host "$gb GB   -   $d"
    }
  }
}
