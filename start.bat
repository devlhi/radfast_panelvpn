@echo off
setlocal EnableExtensions EnableDelayedExpansion
title RadFast ACS — Admin Panel

REM ═══════════════════════════════════════════════════════════════════════════
REM  RadFast Admin — Dev Starter (Windows)
REM  Double-click untuk jalankan backend + frontend dev server sekaligus.
REM ═══════════════════════════════════════════════════════════════════════════

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "BACKEND_PORT=9000"
set "FRONTEND_PORT=5173"

echo.
echo  ██████╗  █████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗
echo  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝
echo  ██████╔╝███████║██║  ██║█████╗  ███████║███████╗   ██║
echo  ██╔══██╗██╔══██║██║  ██║██╔══╝  ██╔══██║╚════██║   ██║
echo  ██║  ██║██║  ██║██████╔╝██║     ██║  ██║███████║   ██║
echo  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝
echo.
echo  RadFast ACS Admin Panel — Dev Mode
echo  ════════════════════════════════════════════════
echo.

REM ── Pre-flight: node ────────────────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo  [X] Node.js tidak ditemukan. Install di: https://nodejs.org/
    goto :fatal
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo  [v] Node.js %NODE_VER%

REM ── Pre-flight: pnpm atau npm ──────────────────────────────────────────
set "PKG_CMD=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 (
    set "PKG_CMD=npm"
    echo  [!] pnpm tidak ditemukan — fallback ke npm
) else (
    for /f "tokens=*" %%v in ('pnpm -v 2^>nul') do echo  [v] pnpm %%v
)

REM ── Pre-flight: .env backend ──────────────────────────────────────────
if not exist "%BACKEND%\.env" (
    if exist "%BACKEND%\.env.example" (
        echo  [i] .env tidak ada — menyalin dari .env.example...
        copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
        echo  [v] .env dibuat
    ) else (
        echo  [X] %BACKEND%\.env tidak ada dan .env.example tidak ditemukan.
        goto :fatal
    )
)
echo  [v] .env ditemukan

REM ── Auto-generate password hash jika masih default / kosong ─────────
set "DEFAULT_HASH=DvRQJktYbyea0DUjphIkfeTaz9L"
set "NEED_HASH=0"

REM Cek apakah hash masih default atau kosong
findstr /C:"%DEFAULT_HASH%" "%BACKEND%\.env" >nul 2>nul && set "NEED_HASH=1"
findstr /RC:"^ADMIN_PASSWORD_HASH=$" "%BACKEND%\.env" >nul 2>nul && set "NEED_HASH=1"

if "!NEED_HASH!"=="1" (
    echo.
    echo  ════════════════════════════════════════════════
    echo  [*] Password admin masih default — membuat hash baru...
    echo  ════════════════════════════════════════════════

    REM Pastikan bcryptjs ada dulu
    if not exist "%BACKEND%\node_modules\bcryptjs" (
        echo  [i] Install deps dulu untuk generate hash...
        pushd "%BACKEND%"
        call %PKG_CMD% install
        popd
    )

    REM Generate password baru + hash + tulis ke .env
    pushd "%BACKEND%"
    node scripts\set-admin-password.js --gen
    if errorlevel 1 (
        echo  [X] Gagal generate password. Lanjut manual.
    ) else (
        echo  [v] Password baru berhasil dibuat dan disimpan ke .env
    )
    popd
    echo  ════════════════════════════════════════════════
    echo.
) else (
    echo  [v] Password hash sudah dikonfigurasi
)

REM ── Install backend deps jika belum ada ──────────────────────────────
if not exist "%BACKEND%\node_modules\express" (
    echo  [i] Backend: menginstall dependencies...
    pushd "%BACKEND%"
    call %PKG_CMD% install
    if errorlevel 1 ( echo  [X] Install backend deps gagal. & popd & goto :fatal )
    popd
    echo  [v] Backend deps terinstall
) else (
    echo  [v] Backend deps OK
)

REM ── Install frontend deps jika belum ada ─────────────────────────────
if not exist "%FRONTEND%\node_modules\vue" (
    echo  [i] Frontend: menginstall dependencies...
    pushd "%FRONTEND%"
    call %PKG_CMD% install
    if errorlevel 1 ( echo  [X] Install frontend deps gagal. & popd & goto :fatal )
    popd
    echo  [v] Frontend deps terinstall
) else (
    echo  [v] Frontend deps OK
)

REM ── Cek apakah port sudah dipakai ──────────────────────────────────
netstat -ano 2>nul | find ":%BACKEND_PORT% " >nul
if not errorlevel 1 (
    echo  [!] Port %BACKEND_PORT% sudah dipakai proses lain.
    echo      Hentikan proses tersebut atau ubah PORT di backend\.env
)

netstat -ano 2>nul | find ":%FRONTEND_PORT% " >nul
if not errorlevel 1 (
    echo  [!] Port %FRONTEND_PORT% sudah dipakai proses lain.
)

REM ── Buat folder data + logs ──────────────────────────────────────────
if not exist "%BACKEND%\data\logs" (
    mkdir "%BACKEND%\data\logs" >nul 2>nul
    echo  [v] Folder data/logs dibuat
)

echo.
echo  ════════════════════════════════════════════════
echo  [*] Menjalankan services...
echo  ════════════════════════════════════════════════
echo.

REM ── Start backend di window terpisah ─────────────────────────────────
start "RadFast Backend :9000" cmd /k ^
    "title RadFast Backend ^& color 0A ^& cd /d ""%BACKEND%"" ^& echo  Backend starting... ^& node server.js"

REM ── Tunggu backend ready (maks 10 detik) ─────────────────────────────
echo  [i] Menunggu backend siap...
set "READY=0"
for /l %%i in (1,1,10) do (
    if "!READY!"=="0" (
        timeout /t 1 /nobreak >nul
        netstat -ano 2>nul | find ":%BACKEND_PORT% " >nul
        if not errorlevel 1 set "READY=1"
    )
)
if "!READY!"=="1" (
    echo  [v] Backend siap di port %BACKEND_PORT%
) else (
    echo  [!] Backend belum merespons setelah 10 detik — cek window backend
)

REM ── Start frontend dev server di window terpisah ─────────────────────
start "RadFast Frontend :5173" cmd /k ^
    "title RadFast Frontend ^& color 0B ^& cd /d ""%FRONTEND%"" ^& echo  Frontend starting... ^& %PKG_CMD% run dev"

echo  [i] Menunggu frontend siap...
timeout /t 3 /nobreak >nul

REM ── Buka browser otomatis ────────────────────────────────────────────
start "" "http://localhost:%FRONTEND_PORT%"

echo.
echo  ════════════════════════════════════════════════
echo  [v] RadFast Admin berjalan!
echo.
echo      Dashboard : http://localhost:%FRONTEND_PORT%
echo      Backend   : http://localhost:%BACKEND_PORT%
echo      API Health: http://localhost:%BACKEND_PORT%/api/health
echo.
echo  [i] Tutup window "RadFast Backend" dan "RadFast Frontend"
echo      untuk menghentikan server.
echo  ════════════════════════════════════════════════
echo.
pause
endlocal
exit /b 0

:fatal
echo.
echo  ════════════════════════════════════════════════
echo  [X] Startup gagal. Periksa pesan error di atas.
echo  ════════════════════════════════════════════════
echo.
pause
endlocal
exit /b 1
