# Handle popup dialogs (dismiss, accept, or read)
# Usage: handle_dialog.ps1 <action>
# Actions: dismiss, accept, read
param([string]$Action = "read")

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement

# Find dialog windows
$dialogCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Window
)

$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $dialogCondition)
$dialogs = @()

foreach ($w in $windows) {
    # Check if it's a dialog (has IsDialog or small size)
    $name = $w.Current.Name
    $rect = $w.Current.BoundingRectangle
    if ($rect.Width -lt 800 -and $rect.Height -lt 600 -and $name) {
        $dialogs += $w
    }
}

if ($dialogs.Count -eq 0) {
    Write-Output "No dialog windows found"
    exit 0
}

foreach ($dialog in $dialogs) {
    $dialogName = $dialog.Current.Name
    Write-Output "Dialog: $dialogName"

    switch ($Action.ToLower()) {
        "read" {
            # Read all text from dialog
            $textCondition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::Text
            )
            $texts = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCondition)
            foreach ($t in $texts) {
                if ($t.Current.Name) { Write-Output "  Text: $($t.Current.Name)" }
            }
        }
        "dismiss" {
            # Try Cancel, No, Close buttons
            $clicked = $false
            foreach ($btnName in @("Cancel", "취소", "No", "아니오", "Close", "닫기", "X")) {
                $btnCondition = New-Object System.Windows.Automation.PropertyCondition(
                    [System.Windows.Automation.AutomationElement]::NameProperty,
                    $btnName,
                    [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
                )
                $btn = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $btnCondition)
                if ($btn) {
                    try {
                        $invoke = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
                        $invoke.Invoke()
                        Write-Output "Dismissed dialog '$dialogName' via '$btnName' button"
                        $clicked = $true
                        break
                    } catch {}
                }
            }
            if (-not $clicked) {
                Write-Output "Could not find dismiss button in dialog '$dialogName'"
            }
        }
        "accept" {
            # Try OK, Yes, Save buttons
            $clicked = $false
            foreach ($btnName in @("OK", "확인", "Yes", "예", "Save", "저장")) {
                $btnCondition = New-Object System.Windows.Automation.PropertyCondition(
                    [System.Windows.Automation.AutomationElement]::NameProperty,
                    $btnName,
                    [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
                )
                $btn = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $btnCondition)
                if ($btn) {
                    try {
                        $invoke = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
                        $invoke.Invoke()
                        Write-Output "Accepted dialog '$dialogName' via '$btnName' button"
                        $clicked = $true
                        break
                    } catch {}
                }
            }
            if (-not $clicked) {
                Write-Output "Could not find accept button in dialog '$dialogName'"
            }
        }
    }
}
