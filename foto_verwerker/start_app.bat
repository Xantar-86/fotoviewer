@echo off
echo FotoVerwerker starten...
python main.py
if errorlevel 1 (
    echo.
    echo [FOUT] App kon niet starten. Zorg dat alle afhankelijkheden zijn geinstalleerd:
    echo   pip install -r requirements.txt
    pause
)
