# Click a UI element by name in a window
# Usage: click_element.ps1 "ElementName" --window "WindowTitle"
param(
    [string]$ElementName,
    [string]$window
)

if (-not $ElementName) {
    Write-Error "Usage: click_element.ps1 <ElementName> --window <WindowTitle>"
    exit 1
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement

# Find window
$targetWindow = $null
if ($window) {
    $allWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($w in $allWindows) {
        if ($w.Current.Name -like "*$window*") {
            $targetWindow = $w
            break
        }
    }
} else {
    # Use foreground window
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
    }
"@
    $hwnd = [Win32]::GetForegroundWindow()
    $targetWindow = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
}

if (-not $targetWindow) {
    Write-Output "Window not found"
    exit 1
}

# Search for element by name
$nameCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $ElementName,
    [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
)

$element = $targetWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nameCondition)

if (-not $element) {
    # Try partial match
    $allElements = $targetWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($e in $allElements) {
        if ($e.Current.Name -like "*$ElementName*") {
            $element = $e
            break
        }
    }
}

if (-not $element) {
    Write-Output "Element '$ElementName' not found"
    exit 1
}

# Try InvokePattern first (buttons, menu items)
try {
    $invokePattern = $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Write-Output "Clicked '$ElementName' successfully"
    exit 0
} catch {}

# Try TogglePattern (checkboxes)
try {
    $togglePattern = $element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
    $togglePattern.Toggle()
    Write-Output "Toggled '$ElementName' successfully"
    exit 0
} catch {}

# Fallback: click at element center
try {
    $rect = $element.Current.BoundingRectangle
    $x = [int]($rect.X + $rect.Width / 2)
    $y = [int]($rect.Y + $rect.Height / 2)

    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class MouseClick {
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int X, int Y);
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
    }
"@
    [MouseClick]::SetCursorPos($x, $y)
    [MouseClick]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)  # MOUSEEVENTF_LEFTDOWN
    [MouseClick]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)  # MOUSEEVENTF_LEFTUP
    Write-Output "Clicked '$ElementName' at ($x, $y)"
} catch {
    Write-Output "Failed to click '$ElementName': $_"
    exit 1
}
