@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

if not exist ".mongo-data" mkdir ".mongo-data"

REM --- is MongoDB already running on 27017 (e.g. installed as a Windows service)? ---
set "MONGO_RUNNING="
netstat -an | findstr ":27017" | findstr "LISTENING" >nul 2>nul && set "MONGO_RUNNING=1"

REM --- otherwise locate mongod: PATH, then a standard Program Files install, then a local portable copy ---
set "MONGOD="
where mongod >nul 2>nul && set "MONGOD=mongod"
if not defined MONGOD (
  for /f "delims=" %%F in ('dir /b /s "C:\Program Files\MongoDB\Server\*\bin\mongod.exe" 2^>nul') do set "MONGOD=%%F"
)
if not defined MONGOD if exist "%~dp0..\mongodb\bin\mongod.exe" set "MONGOD=%~dp0..\mongodb\bin\mongod.exe"

if defined MONGO_RUNNING (
  echo === MongoDB already running on :27017 ^(service^) - not launching another ===
) else (
  if defined MONGOD (
    echo === Starting MongoDB ===
    echo     !MONGOD!
    start "MongoDB" "!MONGOD!" --dbpath ".mongo-data" --port 27017
  ) else (
    echo *** MongoDB not found - starting in DEMO MODE ^(data will NOT be saved^) ***
    echo     To enable persistence, install MongoDB in an ADMIN terminal:
    echo         choco install mongodb -y
    echo     then re-run this script.
  )
)

echo === Starting backend API (new window) ===
start "Fog API" cmd /k "cd server && node src\index.js"

echo === Starting frontend (new window) ===
start "Fog UI" cmd /k npm run dev

echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:4000/api/health
if defined MONGO_RUNNING (echo MongoDB:   mongodb://localhost:27017 ^(running^)) else (if defined MONGOD (echo MongoDB:   starting...) else (echo MongoDB:   DEMO MODE - not running))
echo (Close the opened windows to stop.)
