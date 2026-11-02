@echo off
setlocal
cd /d "%~dp0\.."

echo === Checking Node.js ===
where node >nul 2>nul || (echo Node.js not found. Install Node 18+ from https://nodejs.org && exit /b 1)

echo === Installing frontend dependencies ===
call npm install || exit /b 1

echo === Installing backend dependencies ===
pushd server
call npm install || (popd & exit /b 1)
popd

if not exist "server\.env" (
  echo === Creating server\.env from example ===
  copy "server\.env.example" "server\.env" >nul
)

echo === Checking MongoDB ===
set "MONGOD="
where mongod >nul 2>nul && set "MONGOD=1"
if not defined MONGOD for /f "delims=" %%F in ('dir /b /s "C:\Program Files\MongoDB\Server\*\bin\mongod.exe" 2^>nul') do set "MONGOD=1"
if defined MONGOD (
  echo MongoDB found.
) else (
  echo WARNING: MongoDB not installed. The app still runs in demo mode without it.
  echo To enable persistence, install MongoDB in an ADMIN terminal, then re-run start.bat:
  echo     choco install mongodb -y
  echo   ^(or download it from https://www.mongodb.com/try/download/community^)
)

echo.
echo Setup complete. Run scripts\start.bat to launch everything.
pause
