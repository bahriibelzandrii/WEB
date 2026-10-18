@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ====================================================
echo   Lab 4. Serwis remontu (авторизація, 4 ролі)
echo   one-click launch (Docker: app + PostgreSQL 18)
echo ====================================================
echo.

REM ---------- 1. Docker ----------
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed.
    echo   Install Docker Desktop: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running.
    echo   Start Docker Desktop and run this script again.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker is running

REM ---------- 2. Build + start (db + app) ----------
echo [..] Building image and starting services...
echo      (first run may take a few minutes: npm ci + prisma generate inside the image)
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Could not start the services.
    echo   Check the build log above.
    pause
    exit /b 1
)

REM ---------- 3. Wait for the app (migrations + seed + server) ----------
set /a tries=0
:waitapp
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 (
    set /a tries+=1
    if %tries% geq 90 (
        echo [ERROR] The app did not become ready within 90 seconds.
        echo   Check logs: docker compose logs app
        pause
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    goto waitapp
)
echo [OK] App is ready (migrations applied, demo data loaded)

echo.
echo ====================================================
echo   READY!
echo.
echo   App:          http://localhost:3000
echo   Health:       http://localhost:3000/health
echo   PostgreSQL:   localhost:5433 (db: lab1_service)
echo.
echo   Stop:         stop.bat
echo   Reset data:   docker compose down -v  (then start.bat again)
echo ====================================================
echo.
pause
