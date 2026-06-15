@echo off
REM Launches the Limbus Utility Tracker local app and opens it in your browser.
cd /d "%~dp0"
echo Starting Limbus Utility Tracker...
python "app\server.py"
pause
