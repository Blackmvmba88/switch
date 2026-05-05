param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

function Write-Check {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )

    $status = if ($Ok) { "OK" } else { "WARN" }
    Write-Host ("[{0}] {1}: {2}" -f $status, $Name, $Detail)
}

$xoutputPath = Join-Path $Root "XOutput.exe"
$settingsPath = Join-Path $Root "settings.json"

Write-Host "=== XOutput Windows Diagnostic ==="
Write-Host ("Root: {0}" -f $Root)

Write-Check -Name "XOutput.exe" -Ok (Test-Path -LiteralPath $xoutputPath) -Detail $xoutputPath
Write-Check -Name "settings.json" -Ok (Test-Path -LiteralPath $settingsPath) -Detail $settingsPath

if (Test-Path -LiteralPath $settingsPath) {
    try {
        Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json | Out-Null
        Write-Check -Name "settings.json parse" -Ok $true -Detail "JSON valido"
    } catch {
        Write-Check -Name "settings.json parse" -Ok $false -Detail $_.Exception.Message
    }
}

$process = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "XOutput" }
Write-Check -Name "XOutput process" -Ok ($null -ne $process) -Detail ($(if ($process) { ($process | ForEach-Object { "PID=$($_.Id) Path=$($_.Path)" }) -join "; " } else { "No esta corriendo" }))

$devices = @(Get-CimInstance Win32_PnPEntity | Where-Object {
    $_.Name -match "Nintendo|Switch|Rock Candy|Xbox 360|Nefarius|ViGEm|HID.*juego|game controller" -or
    $_.PNPDeviceID -match "VID_0E6F&PID_0187|VID_045E&PID_028E"
})

$switchDevice = @($devices | Where-Object { $_.Name -match "Nintendo|Switch|Rock Candy" -or $_.PNPDeviceID -match "VID_0E6F&PID_0187" })
$xboxDevice = @($devices | Where-Object { $_.Name -match "Xbox 360" -or $_.PNPDeviceID -match "VID_045E&PID_028E" })
$vigemDevice = @($devices | Where-Object { $_.Name -match "Nefarius|ViGEm" })

Write-Check -Name "Switch/Rock Candy device" -Ok ($switchDevice.Count -gt 0) -Detail ($(if ($switchDevice.Count) { ($switchDevice | ForEach-Object { "$($_.Name) [$($_.PNPDeviceID)]" }) -join "; " } else { "No detectado" }))
Write-Check -Name "Xbox 360 virtual controller" -Ok ($xboxDevice.Count -gt 0) -Detail ($(if ($xboxDevice.Count) { ($xboxDevice | ForEach-Object { "$($_.Name) [$($_.PNPDeviceID)]" }) -join "; " } else { "No detectado" }))
Write-Check -Name "Nefarius/ViGEm bus" -Ok ($vigemDevice.Count -gt 0) -Detail ($(if ($vigemDevice.Count) { ($vigemDevice.Name -join "; ") } else { "No detectado" }))

Write-Host "=== Done ==="
