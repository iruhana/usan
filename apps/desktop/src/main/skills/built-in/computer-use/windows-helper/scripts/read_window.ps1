# Read text content from a window using UIAutomation
# Usage: read_window.ps1 "WindowTitle"
param([string]$WindowTitle)

if (-not $WindowTitle) {
    Write-Error "Usage: read_window.ps1 <WindowTitle>"
    exit 1
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $WindowTitle,
    [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
)

$window = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $condition)

if (-not $window) {
    # Try partial match
    $allWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($w in $allWindows) {
        if ($w.Current.Name -like "*$WindowTitle*") {
            $window = $w
            break
        }
    }
}

if (-not $window) {
    Write-Output "Window '$WindowTitle' not found"
    exit 1
}

# Get all text elements
$textCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Text
)

$textElements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCondition)
$texts = @()
foreach ($elem in $textElements) {
    $name = $elem.Current.Name
    if ($name) { $texts += $name }
}

# Also try ValuePattern for edit controls
$editCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
)

$editElements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition)
foreach ($elem in $editElements) {
    try {
        $valuePattern = $elem.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $value = $valuePattern.Current.Value
        if ($value) { $texts += "EditField: $value" }
    } catch {}
}

# Also try Document control type
$docCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Document
)

$docElements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $docCondition)
foreach ($elem in $docElements) {
    try {
        $textPattern = $elem.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
        $docText = $textPattern.DocumentRange.GetText(4096)
        if ($docText) { $texts += "Document: $docText" }
    } catch {}
}

if ($texts.Count -eq 0) {
    Write-Output "No text content found in '$WindowTitle'"
} else {
    Write-Output ($texts -join "`n")
}
