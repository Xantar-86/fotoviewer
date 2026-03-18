@echo off
echo ====================================================
echo   FotoVerwerker - Build Script
echo ====================================================
echo.

:: Controleer of Python beschikbaar is
python --version >nul 2>&1
if errorlevel 1 (
    echo [FOUT] Python niet gevonden. Installeer Python 3.10+ van python.org
    pause
    exit /b 1
)

:: Stap 1: Installeer afhankelijkheden
echo [1/3] Afhankelijkheden installeren...
pip install -r requirements.txt
if errorlevel 1 (
    echo [FOUT] Installatie mislukt. Controleer je internetverbinding.
    pause
    exit /b 1
)

:: Stap 2: Installeer PyInstaller
echo.
echo [2/3] PyInstaller installeren...
pip install pyinstaller>=6.0
if errorlevel 1 (
    echo [FOUT] PyInstaller installatie mislukt.
    pause
    exit /b 1
)

:: Stap 3: Bouw de .exe
echo.
echo [3/3] .exe bestand bouwen (dit duurt 1-3 minuten)...
python -m PyInstaller foto_verwerker.spec --clean --noconfirm
if errorlevel 1 (
    echo [FOUT] Build mislukt. Controleer de foutmeldingen hierboven.
    pause
    exit /b 1
)

echo.
echo ====================================================
echo   BUILD SUCCESVOL!
echo ====================================================
echo.
echo De applicatie staat in:
echo   %CD%\dist\FotoVerwerker\FotoVerwerker.exe
echo.
echo Kopieer de gehele map 'dist\FotoVerwerker' naar
echo de gewenste locatie om de app te gebruiken.
echo.
pause
