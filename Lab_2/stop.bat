@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Stopping all services (docker compose down: app + database)...
docker compose down
echo.
echo Done.
echo To also delete the database data:  docker compose down -v
echo.
pause
