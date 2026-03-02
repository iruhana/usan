# List clickable UI elements in a window
# Usage: list_ui_elements.ps1 "WindowTitle"
param([string]$WindowTitle)

if (-not $WindowTitle) {
    Write-Error "Usage: list_ui_elements.ps1 <WindowTitle>"
    exit 1
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement

# Find window by partial name match
$targetWindow = $null
$allWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition)
foreach ($w in $allWindows) {
    if ($w.Current.Name -like "*$WindowTitle*") {
        $targetWindow = $w
        break
    }
}

if (-not $targetWindow) {
    Write-Output "Window '$WindowTitle' not found"
    exit 1
}

Write-Output "Window: $($targetWindow.Current.Name)"
Write-Output "---"

# Get clickable elements (buttons, menu items, hyperlinks)
$clickableTypes = @(
    [System.Windows.Automation.ControlType]::Button,
    [System.Windows.Automation.ControlType]::MenuItem,
    [System.Windows.Automation.ControlType]::Hyperlink,
    [System.Windows.Automation.ControlType]::TabItem,
    [System.Windows.Automation.ControlType]::ListItem
)

$results = @()
foreach ($type in $clickableTypes) {
    $condition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        $type
    )
    $elements = $targetWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    foreach ($e in $elements) {
        $name = $e.Current.Name
        if ($name -and $name.Length -gt 0 -and $name.Length -lt 100) {
            $typeName = $e.Current.ControlType.ProgrammaticName -replace "ControlType.", ""
            $results += "[$typeName] $name"
        }
    }
}

if ($results.Count -eq 0) {
    Write-Output "No clickable elements found"
} else {
    $unique = $results | Select-Object -Unique
    $unique | ForEach-Object { Write-Output $_ }
    Write-Output "---"
    Write-Output "Total: $(@($unique).Count) elements"
}
