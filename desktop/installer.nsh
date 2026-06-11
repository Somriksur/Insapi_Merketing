; ------------------------------------------------------------
; Insapi Marketing Workspace - Custom NSIS Installer Script
; This handles desktop shortcuts and proper installation flow
; ------------------------------------------------------------

!include "MUI2.nsh"

; Variables for desktop shortcut
Var CreateDesktopShortcut

; ------------------------------------------------------------
; Custom page to ask about desktop shortcut
; ------------------------------------------------------------
!macro customInstallPage
  ; Add a page asking if user wants desktop shortcut
  Page custom DesktopShortcutPage DesktopShortcutPageLeave
!macroend

Function DesktopShortcutPage
  !insertmacro MUI_HEADER_TEXT "Desktop Shortcut" "Would you like a desktop shortcut?"
  
  nsDialogs::Create 1018
  Pop $0
  
  ${NSD_CreateLabel} 0 0 100% 24u "Create a desktop shortcut for easy access to Insapi Marketing?"
  Pop $0
  
  ${NSD_CreateCheckbox} 0 30u 100% 12u "Create desktop shortcut"
  Pop $1
  ${NSD_Check} $1  ; Check by default
  
  nsDialogs::Show
FunctionEnd

Function DesktopShortcutPageLeave
  ${NSD_GetState} $1 $CreateDesktopShortcut
FunctionEnd


; ------------------------------------------------------------
; Installation Logic
; ------------------------------------------------------------

!macro customInstall
  ; Create desktop shortcut if user selected it
  ${If} $CreateDesktopShortcut == ${BST_CHECKED}
    DetailPrint "Creating desktop shortcut..."
    SetShellVarContext current
    CreateShortCut "$DESKTOP\Insapi Marketing.lnk" \
      "$INSTDIR\Insapi Marketing.exe" \
      "" \
      "$INSTDIR\Insapi Marketing.exe" \
      0 \
      SW_SHOWNORMAL \
      "" \
      "Launch Insapi Marketing"
    DetailPrint "Desktop shortcut created!"
  ${Else}
    DetailPrint "Skipping desktop shortcut (user choice)"
  ${EndIf}
  
  ; Start Menu shortcuts - ALWAYS create
  DetailPrint "Creating Start Menu shortcuts..."
  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\Insapi Marketing"
  
  CreateShortCut "$SMPROGRAMS\Insapi Marketing\Insapi Marketing.lnk" \
    "$INSTDIR\Insapi Marketing.exe" \
    "" \
    "$INSTDIR\Insapi Marketing.exe" \
    0 \
    SW_SHOWNORMAL \
    "" \
    "Launch Insapi Marketing"
  
  CreateShortCut "$SMPROGRAMS\Insapi Marketing\Uninstall.lnk" \
    "$INSTDIR\Uninstall Insapi Marketing Workspace.exe"
  
  DetailPrint "Start Menu shortcuts created!"

  ; Registry entries
  DetailPrint "Registering application..."
  WriteRegStr HKCU "Software\InsapiMarketing\Workspace" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\InsapiMarketing\Workspace" "Version" "${VERSION}"

  ; Add/Remove Programs
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayName" "Insapi Marketing"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayIcon" "$INSTDIR\Insapi Marketing.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "Publisher" "Insapi Marketing"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "URLInfoAbout" "https://insapimarketing.com"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "HelpLink" "https://insapimarketing.com/support"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "NoRepair" 1

  DetailPrint ""
  DetailPrint "Installation completed successfully!"
  DetailPrint "You can now launch Insapi Marketing"
  DetailPrint ""
!macroend


; ------------------------------------------------------------
; Uninstall Logic
; ------------------------------------------------------------

!macro customUnInstall
  DetailPrint "Removing shortcuts..."
  
  ; Remove desktop shortcut
  Delete "$DESKTOP\Insapi Marketing.lnk"

  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\Insapi Marketing\Insapi Marketing.lnk"
  Delete "$SMPROGRAMS\Insapi Marketing\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Insapi Marketing"

  ; Remove registry entries
  DetailPrint "Cleaning registry..."
  DeleteRegKey HKCU "Software\InsapiMarketing\Workspace"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"

  DetailPrint "Uninstallation completed!"
!macroend
