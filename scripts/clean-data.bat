@echo off
cd /d "%~dp0\.."
node server\scripts\clean-data.js
pause
