@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Runs from repository root
cd /d "%~dp0"

echo [deploy] Working dir: %CD%

echo [deploy] Checking prerequisites (Node.js + npm)...
where node >nul 2>nul
if errorlevel 1 (
  echo [deploy] ERROR: Node.js is not installed or not in PATH.
  echo [deploy] Install Node.js LTS and try again.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [deploy] ERROR: npm is not available in PATH.
  exit /b 1
)

call :install "backend" || exit /b %ERRORLEVEL%
call :install "front\sistema-pos-front" || exit /b %ERRORLEVEL%
call :build_front || exit /b %ERRORLEVEL%

echo [deploy] OK: dependencies installed and frontend compiled.
echo [deploy] Next: start backend with:  cd backend ^&^& npm start
exit /b 0

:install
set "DIR=%~1"
if not exist "%DIR%\package.json" (
  echo [deploy] ERROR: "%DIR%\package.json" not found.
  exit /b 1
)

echo.
echo [deploy] Installing dependencies in %DIR% ...
pushd "%DIR%" || exit /b 1

if exist "package-lock.json" (
  echo [deploy] Using npm ci
  call npm ci
) else (
  echo [deploy] Using npm install
  call npm install
)
set "EC=%ERRORLEVEL%"
popd
if not "%EC%"=="0" (
  echo [deploy] ERROR: install failed in %DIR% (exit %EC%).
  exit /b %EC%
)
exit /b 0

:build_front
set "FRONT_DIR=front\sistema-pos-front"

echo.
echo [deploy] Building frontend (Vite) ...
pushd "%FRONT_DIR%" || exit /b 1
call npm run build
set "EC=%ERRORLEVEL%"
popd
if not "%EC%"=="0" (
  echo [deploy] ERROR: frontend build failed (exit %EC%).
  exit /b %EC%
)

if not exist "%FRONT_DIR%\dist\index.html" (
  echo [deploy] ERROR: build completed but "%FRONT_DIR%\dist\index.html" was not found.
  exit /b 1
)

echo [deploy] Frontend build output: %FRONT_DIR%\dist
exit /b 0
