@echo off
REM ===========================================================================
REM  RadFast Admin - Password Reset Tool (Windows)
REM ===========================================================================
REM  Pakai saat lupa password admin atau 2FA tidak bisa diakses.
REM
REM  Cara pakai:
REM    reset-password.bat                              # interactive
REM    reset-password.bat --gen                        # auto-generate random
REM    reset-password.bat --gen --reset-2fa            # + hapus 2FA
REM    reset-password.bat --password "XyZ@123!"        # non-interactive
REM    reset-password.bat --username admin2 --gen --reset-2fa
REM    reset-password.bat --help
REM
REM  Tip: bisa di-double-click untuk masuk mode interaktif.
REM ===========================================================================

setlocal EnableExtensions EnableDelayedExpansion
title RadFast Admin - Password Reset

REM --- Resolve script directory & backend folder ---------------------------
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"

if not exist "%BACKEND_DIR%\server.js" (
    if exist "%SCRIPT_DIR%server.js" (
        set "BACKEND_DIR=%SCRIPT_DIR%"
    ) else (
        echo [X] Backend tidak ditemukan di %BACKEND_DIR%
        echo     Jalankan reset-password.bat dari folder root project.
        goto :pause_end
    )
)

REM --- Pre-flight: node ----------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js belum terinstall. Install dulu: https://nodejs.org/
    goto :pause_end
)

REM --- Pre-flight: .env ----------------------------------------------------
if not exist "%BACKEND_DIR%\.env" (
    echo [X] %BACKEND_DIR%\.env tidak ada.
    echo     Salin dulu: copy %BACKEND_DIR%\.env.example %BACKEND_DIR%\.env
    goto :pause_end
)

REM --- Pre-flight: bcryptjs ------------------------------------------------
if not exist "%BACKEND_DIR%\node_modules\bcryptjs" (
    echo [i] Dependencies belum terinstall. Menjalankan pnpm install...
    pushd "%BACKEND_DIR%"
    where pnpm >nul 2>nul
    if errorlevel 1 (
        call npm install
    ) else (
        call pnpm install
    )
    popd
)

REM --- Run the recovery utility (forward all args verbatim) ----------------
pushd "%BACKEND_DIR%"
node ".\scripts\set-admin-password.js" %*
set "RC=%ERRORLEVEL%"
popd

if not "%RC%"=="0" (
    echo.
    echo [X] Reset GAGAL ^(exit code %RC%^).
    echo     Periksa pesan error di atas.
    goto :pause_end
)

REM --- Resolve backend port from .env (fallback 9000) ---------------------
set "APP_PORT=9000"
for /f "usebackq tokens=1,* delims==" %%K in ("%BACKEND_DIR%\.env") do (
    if /I "%%K"=="PORT" set "APP_PORT=%%L"
)
REM Trim possible surrounding spaces/quotes from the value
set "APP_PORT=%APP_PORT: =%"
set "APP_PORT=%APP_PORT:"=%"

REM --- Find the PID that owns the backend port ----------------------------
set "BACKEND_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%APP_PORT% .*LISTENING"') do (
    if not defined BACKEND_PID set "BACKEND_PID=%%P"
)

if defined BACKEND_PID (
    echo.
    echo [i] Backend terdeteksi jalan di port %APP_PORT% ^(PID %BACKEND_PID%^).
    set /p "ANS=    Stop dan restart backend otomatis? [Y/n] "
    if /I "!ANS!"=="" set "ANS=Y"
    if /I "!ANS!"=="y" (
        echo [i] Stopping PID !BACKEND_PID! ...
        taskkill /F /PID !BACKEND_PID! >nul 2>nul
        timeout /t 1 /nobreak >nul

        REM Start backend in a NEW window so password change takes effect
        echo [v] Restarting backend di window baru...
        start "RadFast Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && node server.js"
        timeout /t 2 /nobreak >nul
        echo [v] Backend restarted. Cek window baru bertitle "RadFast Backend".
    ) else (
        echo [!] Anda HARUS stop dan start ulang backend manual:
        echo       taskkill /F /PID !BACKEND_PID!
        echo       cd /d "%BACKEND_DIR%" ^&^& node server.js
    )
) else (
    echo.
    echo [i] Backend tidak terdeteksi jalan di port %APP_PORT%. Start manual:
    echo       cd /d "%BACKEND_DIR%" ^&^& node server.js
)

echo.
echo ===========================================================================
echo   SELESAI - silakan login dengan password baru di http://localhost:%APP_PORT%
echo ===========================================================================

:pause_end
echo.
echo Tekan tombol apa saja untuk menutup window ini...
pause >nul
endlocal & exit /b %RC%
