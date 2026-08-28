$targets = @(
  'C:\Users\CARLOS\AppData\Local\npm-cache',
  'C:\Users\CARLOS\AppData\Local\Temp',
  'C:\Users\CARLOS\AppData\Local\Docker',
  'C:\Users\CARLOS\AppData\Local\Google',
  'C:\Users\CARLOS\AppData\Local\BraveSoftware',
  'C:\Users\CARLOS\AppData\Roaming\npm',
  'C:\Users\CARLOS\AppData\Roaming\npm-cache',
  'C:\Users\CARLOS\.gemini',
  'C:\Users\CARLOS\.commandcode',
  'C:\Users\CARLOS\.npm',
  'C:\Users\CARLOS\.cache',
  'C:\Users\CARLOS\PROJEKTE',
  'C:\Users\CARLOS\Desktop',
  'C:\Users\CARLOS\AppData\Local\pnpm',
  'C:\Users\CARLOS\AppData\Local\Yarn',
  'C:\Users\CARLOS\AppData\Local\Microsoft\WindowsApps',
  'C:\Users\CARLOS\AppData\Local\Programs'
)

$results = @()
foreach ($path in $targets) {
  if (Test-Path $path) {
    $size = (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeGB = [math]::Round($size / 1GB, 2)
    $results += [PSCustomObject]@{ SizeGB = $sizeGB; Path = $path }
  }
}
$results | Sort-Object SizeGB -Descending | Format-Table SizeGB, Path -AutoSize
