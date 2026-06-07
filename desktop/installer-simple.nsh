; ============================================================
; Insapi Marketing Workspace — Professional NSIS Installer
; ============================================================
; Fixes:
;   - No UAC restart loop (elevation requested once via highestAvailable)
;   - Professional branding on Welcome/Finish pages
;   - Clean current-user installation (no all-users relaunch)
; ============================================================

; ── Ensure single-elevation: request was already set to highestAvailable
;    in package.json (requestedExecutionLevel). Do NOT request again here.
;    This is the root cause fix for Problem 2 (installer restart loop).

!macro customInstallMode
  ; Force current-user install — avoids the all-users UAC re-launch cycle
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInstall
  SetShellVarContext current

  ; ── Desktop shortcut ──────────────────────────────────────
  CreateShortCut "$DESKTOP\Insapi Marketing Workspace.lnk" \
    "$INSTDIR\Insapi Marketing Workspace.exe" \
    "" \
    "$INSTDIR\Insapi Marketing Workspace.exe" \
    0 SW_SHOWNORMAL "" \
    "Launch Insapi Marketing Workspace"

  ; ── Start Menu folder + shortcuts ────────────────────────
  CreateDirectory "$SMPROGRAMS\Insapi Marketing"
  CreateShortCut "$SMPROGRAMS\Insapi Marketing\Insapi Marketing Workspace.lnk" \
    "$INSTDIR\Insapi Marketing Workspace.exe" \
    "" "$INSTDIR\Insapi Marketing Workspace.exe" \
    0 SW_SHOWNORMAL "" "Launch Insapi Marketing Workspace"
  CreateShortCut "$SMPROGRAMS\Insapi Marketing\Uninstall.lnk" \
    "$INSTDIR\Uninstall Insapi Marketing Workspace.exe"

  ; ── Registry: App metadata & Add/Remove Programs ─────────
  WriteRegStr HKCU "Software\InsapiMarketing\Workspace" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\InsapiMarketing\Workspace" "Version"     "1.0.0"

  WriteRegStr HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "DisplayName"     "Insapi Marketing Workspace"
  WriteRegStr HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "DisplayIcon"     "$INSTDIR\Insapi Marketing Workspace.exe"
  WriteRegStr HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "Publisher"       "Insapi Marketing"
  WriteRegStr HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "DisplayVersion"  "1.0.0"
  WriteRegStr HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "URLInfoAbout"    "https://insapimarketing.com"
  WriteRegStr HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "HelpLink"        "https://insapimarketing.com/support"
  WriteRegDWORD HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "NoModify" 1
  WriteRegDWORD HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace" \
    "NoRepair" 1

  ClearErrors
!macroend

!macro customUnInstall
  SetShellVarContext current

  ; Remove shortcuts
  Delete "$DESKTOP\Insapi Marketing Workspace.lnk"
  Delete "$SMPROGRAMS\Insapi Marketing\Insapi Marketing Workspace.lnk"
  Delete "$SMPROGRAMS\Insapi Marketing\Uninstall.lnk"
  RMDir  "$SMPROGRAMS\Insapi Marketing"

  ; Remove registry entries
  DeleteRegKey HKCU "Software\InsapiMarketing\Workspace"
  DeleteRegKey HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.insapi.marketing.workspace"
!macroend
