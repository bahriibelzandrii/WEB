@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Stopping the database (docker compose down)...
docker compose down
echo.
echo Done. The server (if running) - stop by closing its window.
echo To also delete the database data:  docker compose down -v
echo.
pause
