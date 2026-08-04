@echo off
REM Launcher installer Orkay untuk Windows.
REM Double-click file ini untuk membuka wizard pemasangan di browser.

cd /d "%~dp0"

echo ======================================
echo         Pemasangan Orkay
echo ======================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js belum terpasang.
  echo       Silakan unduh ^& pasang dari: https://nodejs.org (pilih versi LTS).
  echo       Setelah terpasang, jalankan file ini lagi.
  echo.
  pause
  exit /b 1
)

echo   Membuka wizard di browser...
echo   (Biarkan jendela ini terbuka selama pemasangan.)
echo.

node scripts\wizard\server.mjs

echo.
echo   Wizard ditutup.
pause
