; NSIS custom installer hooks for Usan
; Creates a Scheduled Task for UAC-free elevated launch

!macro customInstall
  ; Create a scheduled task that runs Usan.exe with highest privileges on logon
  nsExec::ExecToLog 'schtasks /create /tn "Usan" /tr "\"$INSTDIR\Usan.exe\"" /sc ONLOGON /rl HIGHEST /f'
!macroend

!macro customUnInstall
  ; Remove the scheduled task on uninstall
  nsExec::ExecToLog 'schtasks /delete /tn "Usan" /f'
!macroend
