!macro preInit
 SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LocalAppData\infinicord"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LocalAppData\infinicord"
 SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LocalAppData\infinicord"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LocalAppData\infinicord"
!macroend

!macro customInstall
  CreateShortcut "$SMPROGRAMS\Infinicord - Profile 1.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--profile 1" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortcut "$SMPROGRAMS\Infinicord - Profile 2.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--profile 2" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortcut "$SMPROGRAMS\Infinicord - Profile 3.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--profile 3" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Infinicord - Profile 1.lnk"
  Delete "$SMPROGRAMS\Infinicord - Profile 2.lnk"
  Delete "$SMPROGRAMS\Infinicord - Profile 3.lnk"
!macroend
