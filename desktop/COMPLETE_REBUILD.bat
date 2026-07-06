@echo off
echo ========================================
echo Insapi Marketing Workspace
echo Complete Rebuild Script
echo ========================================
echo.
echo This will rebuild EVERYTHING from scratch
echo Including ALL dependencies (numpy, pandas, etc.)
echo.
pause

echo [1/7] Cleaning old builds and caches...
if exist dist rmdir /s /q dist
if exist backend-dist rmdir /s /q backend-dist
if exist build rmdir /s /q build
if exist ..\backend\build rmdir /s /q ..\backend\build
if exist ..\backend\dist rmdir /s /q ..\backend\dist
echo     - Old builds removed
echo.

echo [2/7] Cleaning NSIS cache (fixes compressor errors)...
if exist "%LOCALAPPDATA%\electron-builder\Cache\nsis" (
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\nsis"
    echo     - NSIS cache cleared
) else (
    echo     - No NSIS cache found
)
echo.

echo [3/7] Activating Python environment...
cd ..\backend
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo     ERROR: Could not activate Python environment!
    echo     Make sure you have created .venv in backend folder
    pause
    exit /b 1
)
cd ..\desktop
echo     - Python environment activated
echo.

echo [4/7] Installing/Updating Python dependencies...
cd ..\backend
pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller
cd ..\desktop
echo     - Dependencies updated
echo.

echo [5/7] Building backend executable...
echo     This includes: Python, FastAPI, numpy, pandas, openpyxl
echo     This may take 3-5 minutes...
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

echo [6/7] Copying backend to distribution folder...
xcopy /E /I /Y dist\insapi-marketing-backend backend-dist
if errorlevel 1 (
    echo     ERROR: Failed to copy backend!
    pause
    exit /b 1
)
echo     - Backend copied
echo.

echo [7/7] Building Windows installer...
echo     This may take 3-5 minutes...
echo.
npm run dist:win
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
echo   dist\Insapi-Marketing-Setup-1.0.0.exe
echo.
echo What was built:
echo   - Backend: Standalone .exe with ALL dependencies
echo   - Includes: Python, numpy, pandas, openpyxl, FastAPI
echo   - Installer: Professional NSIS installer
echo   - Desktop shortcut: Will be created automatically
echo   - Start Menu: Shortcuts in "Insapi Marketing" folder
echo.
echo Backend size: ~100-150 MB (includes everything)
echo Installer size: ~150-200 MB (self-contained)
echo.
echo Next steps:
echo   1. Test the installer
echo   2. Verify desktop shortcut is created
echo   3. Verify app runs without ANY errors
echo   4. Test on machine without Python
echo.
pause
