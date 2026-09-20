; Keep the first install to one click: the fixed per-machine path and all
; installer pages remain available to the official updater through /UPDATE.
SilentInstall silent

!macro NSIS_HOOK_POSTINSTALL
  ; Initial installs launch the user process after the elevated installer.
  ; Official updater installs already pass /R and launch through the template.
  ${If} $UpdateMode <> 1
    nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" ""
  ${EndIf}
!macroend
