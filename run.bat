@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo    AI Fog Computing Scheduler  -  Install ^& Run
echo ==================================================
echo.

REM --- 1. Node.js ---
where node >nul 2>nul || (echo [X] Node.js not found. Install Node 20.19+ from https://nodejs.org && pause && exit /b 1)
for /f "delims=" %%V in ('node -v') do echo [OK] Node.js %%V

REM --- 2. Frontend dependencies ---
if not exist "node_modules" (
  echo [..] Installing frontend dependencies ^(first run^)...
  call npm install || (echo [X] frontend npm install failed && pause && exit /b 1)
) else (
  echo [OK] frontend dependencies present
)

REM --- 3. Backend dependencies ---
if not exist "server\node_modules" (
  echo [..] Installing backend dependencies ^(first run^)...
  pushd server
  call npm install || (popd && echo [X] backend npm install failed && pause && exit /b 1)
  popd
) else (
  echo [OK] backend dependencies present
)

REM --- 4. server\.env ---
if not exist "server\.env" (
  echo [..] Creating server\.env from example...
  copy "server\.env.example" "server\.env" >nul
)

REM --- 5. MongoDB: detect, auto-install if missing, then ensure it's up ---
call :detect_mongo
if defined MONGO_RUNNING goto MONGO_READY
if defined MONGOD goto MONGO_START

echo.
echo [!] MongoDB is not installed.
where choco >nul 2>nul
if %errorlevel%==0 (
  echo [..] Installing MongoDB via Chocolatey - please APPROVE the Administrator prompt...
  powershell -NoProfile -Command "try { Start-Process choco -ArgumentList 'install','mongodb','-y' -Verb RunAs -Wait } catch { Write-Host 'Install was cancelled or failed.' }"
  goto MONGO_AFTER_INSTALL
)
where winget >nul 2>nul
if %errorlevel%==0 (
  echo [..] Installing MongoDB via winget...
  winget install -e --id MongoDB.Server
  goto MONGO_AFTER_INSTALL
)
echo [X] No Chocolatey or winget found - cannot auto-install.
echo     Install MongoDB manually: https://www.mongodb.com/try/download/community
goto MONGO_DEMO

:MONGO_AFTER_INSTALL
echo [..] Waiting for the MongoDB service to start...
timeout /t 8 /nobreak >nul
call :detect_mongo
if defined MONGO_RUNNING goto MONGO_READY
if defined MONGOD goto MONGO_START
echo [!] MongoDB not detected yet - continuing in demo mode. ^(Re-run this script once it finishes installing.^)
goto MONGO_DEMO

:MONGO_START
echo [..] Starting MongoDB...
if not exist ".mongo-data" mkdir ".mongo-data"
start "MongoDB" "!MONGOD!" --dbpath ".mongo-data" --port 27017
goto MONGO_DONE

:MONGO_READY
echo [OK] MongoDB running on :27017
goto MONGO_DONE

:MONGO_DEMO
echo [!] DEMO MODE - datasets will NOT be saved.
goto MONGO_DONE

:MONGO_DONE

REM --- 6. Free app ports so a fresh backend/frontend can bind (avoids the 500 / EADDRINUSE issue) ---
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4000 " ^| findstr "LISTENING"') do taskkill /f /pid %%P >nul 2>nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%P >nul 2>nul

REM --- 7. Launch backend + frontend in their own windows ---
echo [..] Starting backend  -> http://localhost:4000
start "Fog API" cmd /k "cd server && node src\index.js"
echo [..] Starting frontend -> http://localhost:5173
start "Fog UI" cmd /k npm run dev

echo.
echo ==================================================
echo    Open  http://localhost:5173
echo    Login  admin / admin123
echo    ^(Close the "Fog API" and "Fog UI" windows to stop^)
echo ==================================================
echo.
echo This window can be closed.
pause
exit /b 0

REM ===== helper: detect MongoDB (sets MONGO_RUNNING and/or MONGOD) =====
:detect_mongo
set "MONGO_RUNNING="
netstat -an | findstr ":27017" | findstr "LISTENING" >nul 2>nul && set "MONGO_RUNNING=1"
set "MONGOD="
where mongod >nul 2>nul && set "MONGOD=mongod"
if not defined MONGOD for /f "delims=" %%F in ('dir /b /s "C:\Program Files\MongoDB\Server\*\bin\mongod.exe" 2^>nul') do set "MONGOD=%%F"
if not defined MONGOD if exist "%~dp0mongodb\bin\mongod.exe" set "MONGOD=%~dp0mongodb\bin\mongod.exe"
goto :eof
