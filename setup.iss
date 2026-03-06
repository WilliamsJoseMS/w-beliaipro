; W-Beli.Ai Pro - Inno Setup Script

[Setup]
AppId={{C7A9E5B2-1D4F-4A9C-8E1A-B7F1C2D3E4F5}
AppName=W-Beli.Ai Pro
AppVersion=1.0.0
AppPublisher=Williams José MS
DefaultDirName={autopf}\W-Beli-Ai-Pro
DefaultGroupName=W-Beli.Ai Pro
AllowNoIcons=yes
OutputDir=dist-installer
OutputBaseFilename=W-Beli-Ai-Pro-Setup
SetupIconFile=assets\icons\icon.ico
Compression=lzma
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist-standalone\W-Beli-Ai-Pro.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist-standalone\W-Beli-Ai-Server.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist-standalone\better_sqlite3.node"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist-standalone\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist-standalone\.env"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\icons\icon.ico"; DestDir: "{app}\assets\icons"; Flags: ignoreversion

[Icons]
Name: "{group}\W-Beli.Ai Pro"; Filename: "{app}\W-Beli-Ai-Pro.bat"; IconFilename: "{app}\assets\icons\icon.ico"
Name: "{group}\{cm:UninstallProgram,W-Beli.Ai Pro}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\W-Beli.Ai Pro"; Filename: "{app}\W-Beli-Ai-Pro.bat"; IconFilename: "{app}\assets\icons\icon.ico"; Tasks: desktopicon
Name: "{group}\Ver Consola del Servidor"; Filename: "{app}\W-Beli-Ai-Server.exe"; IconFilename: "{app}\assets\icons\icon.ico"

[Run]
Filename: "{app}\W-Beli-Ai-Pro.bat"; Description: "{cm:LaunchProgram,W-Beli.Ai Pro}"; Flags: shellexec postinstall skipifsilent
