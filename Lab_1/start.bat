@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ====================================================
echo   Lab 1. Model of data: computer repair service
echo   One-click launch
echo ====================================================
echo.

REM ---------- 1. Node.js ----------
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo   Install from https://nodejs.org - LTS, v24 recommended
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -p "process.version"') do set NODEVER=%%v
echo [OK] Node.js %NODEVER%

REM ---------- 2. Docker ----------
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

REM ---------- 3. .env ----------
if not exist .env (
    copy /y .env.example .env >nul
    echo [OK] .env created from .env.example
)

REM ---------- 4. Dependencies ----------
if not exist node_modules (
    echo [..] Installing dependencies via npm ci, may take a minute...
    call npm ci
    if errorlevel 1 (
        echo [ERROR] npm ci failed
        pause
        exit /b 1
    )
)
echo [OK] Dependencies

REM ---------- 5. Database ----------
echo [..] Starting PostgreSQL (docker compose)...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] Could not start the database.
    echo   If the error mentions port 5433 - the port is occupied by another program.
    echo   Change the port in docker-compose.yml and .env, for example to 5434.
    pause
    exit /b 1
)

set /a tries=0
:waitdb
docker compose exec -T db pg_isready -U postgres -d lab1_service >nul 2>&1
if errorlevel 1 (
    set /a tries+=1
    if %tries% geq 90 (
        echo [ERROR] The database did not start within 90 seconds
        pause
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    goto waitdb
)
echo [OK] Database is ready (localhost:5433)

REM ---------- 6. Migrations ----------
echo [..] Applying migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [ERROR] Migrations failed
    pause
    exit /b 1
)
echo [OK] Migrations (15 tables + 9 enum types)

REM ---------- 7. Seed ----------
echo [..] Loading demo data (seed)...
call npm run seed
if errorlevel 1 (
    echo [ERROR] Seed failed
    pause
    exit /b 1
)
echo [OK] Demo data (60 requests, all statuses)

REM ---------- 8. Server ----------
echo.
echo ====================================================
echo   READY!
echo.
echo   Health check:   http://localhost:3000/health
echo   Invariants:     npm run check
echo   Prisma Studio:  npx prisma studio
echo.
echo   To stop the server - close this window.
echo   To stop the database - run stop.bat
echo ====================================================
echo.
call npm start
