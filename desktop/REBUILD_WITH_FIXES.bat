@echo off
echo ========================================
echo Insapi Marketing Workspace
echo COMPLETE REBUILD WITH ALL FIXES
echo ========================================
echo.
echo This will:
echo 1. Use Insapi Marketing logo everywhere
echo 2. Fix backend encodings error
echo 3. Fix desktop shortcut
echo 4. Fix installer flow
echo.
pause

echo [1/9] Cleaning old builds...
if exist dist rmdir /s /q dist
if exist backend-dist rmdir /s /q backend-dist
if exist build rmdir /s /q build
if exist ..\backend\build rmdir /s /q ..\backend\build
if exist ..\backend\dist rmdir /s /q ..\backend\dist
echo     - Old builds removed
echo.

echo [2/9] Cleaning NSIS and electron-builder cache...
if exist "%LOCALAPPDATA%\electron-builder\Cache" (
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"
    echo     - Cache cleared
) else (
    echo     - No cache found
)
echo.

echo [3/9] Converting Insapi logo to ICO format...
echo     Note: If this fails, manually convert insapi-logo.png to icon.ico
echo     You can use an online converter like: https://convertio.co/png-ico/
echo.
rem Try to convert using ImageMagick if available
where magick >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    magick assets\insapi-logo.png -define icon:auto-resize=256,128,96,64,48,32,16 assets\icon.ico
    echo     - Logo converted to ICO
) else (
    echo     WARNING: ImageMagick not found
    echo     Please manually convert assets\insapi-logo.png to assets\icon.ico
    echo     Or install ImageMagick: https://imagemagick.org/script/download.php
    pause
)
echo.

echo [4/9] Copying logo to all locations...
copy /Y assets\insapi-logo.png assets\icon.png
copy /Y assets\insapi-logo.png web\icon.png
copy /Y assets\insapi-logo.png web\logo.png
echo     - Logo copied to all locations
echo.

echo [5/9] Activating Python environment...
cd ..\backend
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
    echo     - Python environment activated
) else (
    echo     ERROR: Python virtual environment not found!
    echo     Please create it first: python -m venv .venv
    pause
    exit /b 1
)
cd ..\desktop
echo.

echo [6/9] Installing/Updating Python dependencies...
cd ..\backend
pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller
cd ..\desktop
echo     - Dependencies updated
echo.

echo [7/9] Building backend with ALL encodings...
echo     This includes: Python, FastAPI, numpy, pandas, ALL encodings
echo     This may take 5-10 minutes...
echo.
pyinstaller backend.spec --clean --noconfirm
if errorlevel 1 (
    echo     ERROR: Backend build failed!
    echo     Check the error messages above
    pause
    exit /b 1
)
echo     - Backend built successfully
echo.

echo [8/9] Copying backend to distribution folder...
xcopy /E /I /Y dist\insapi-marketing-backend backend-dist
if errorlevel 1 (
    echo     ERROR: Failed to copy backend!
    pause
    exit /b 1
)
echo     - Backend copied
echo.

echo [9/9] Building Windows installer...
echo     This may take 5-10 minutes...
echo.
call yarn build:win
if errorlevel 1 (
    echo     ERROR: Installer build failed!
    pause
    exit /b 1
)
echo     - Installer built successfully
echo.

echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Installer location:
echo   dist\Insapi-Marketing-Workspace-Setup-1.0.0.exe
echo.
echo What was fixed:
echo   1. Backend includes ALL encodings (fixes import error)
echo   2. Desktop shortcut will be created
echo   3. Installer has smooth flow (no double-click)
echo   4. Insapi Marketing logo used everywhere
echo.
echo Next steps:
echo   1. Run the installer
echo   2. Check desktop for shortcut
echo   3. Launch app and verify no errors
echo.
pause
