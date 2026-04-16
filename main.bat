@echo off
chcp 65001 >nul
title Camera Monitoring System

cd /d "%~dp0"

set "VENV_DIR=venv"
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_NAME=postgres"
set "DB_USER=postgres"
set "DB_PASSWORD=qwerty"
set "FLASK_APP=app.py"
set "PORT=8080"
set "HOST=0.0.0.0"

:: Отключаем запрос при нажатии Ctrl+C
break >nul

:: Проверка Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не установлен!
    pause
    exit /b 1
)

:: Проверка/создание venv
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Создание виртуального окружения...
    python -m venv %VENV_DIR%
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось создать venv
        pause
        exit /b 1
    )
)

:: Активация venv
call "%VENV_DIR%\Scripts\activate.bat"

:: Проверка и установка библиотек
pip show Flask >nul 2>&1
if errorlevel 1 (
    echo Установка библиотек...
    pip install Flask psycopg[binary] openpyxl python-dotenv
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось установить библиотеки
        pause
        exit /b 1
    )
)

:menu
cls
echo.
echo ================================
echo    Camera Monitoring System
echo ================================
echo.
echo   1 - Запустить сервер
echo   2 - Создать резервную копию БД
echo   0 - Выход
echo.
echo ================================
echo.
set /p choice="Выберите действие: "

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto backup_db
if "%choice%"=="0" exit /b 0
echo Неверный выбор
pause
goto menu

:start_server
cls
echo.
echo ================================
echo    ЗАПУСК СЕРВЕРА
echo ================================
echo.
echo Сервер запускается...
echo Адрес: http://localhost:%PORT%
echo.
echo Для остановки сервера нажмите Ctrl+C
echo.
echo ================================
echo.
python %FLASK_APP%
goto menu

:backup_db
cls
echo.
echo ================================
echo    РЕЗЕРВНОЕ КОПИРОВАНИЕ БД
echo ================================
echo.
:: Поиск PostgreSQL
set "PG_PATH="
for /d %%i in ("C:\Program Files\PostgreSQL\*") do (
    if exist "%%i\bin\pg_dump.exe" (
        set "PG_PATH=%%i\bin\"
        goto :found_pg
    )
)
for /d %%i in ("C:\Program Files (x86)\PostgreSQL\*") do (
    if exist "%%i\bin\pg_dump.exe" (
        set "PG_PATH=%%i\bin\"
        goto :found_pg
    )
)
where pg_dump >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%i in ('where pg_dump') do (
        set "PG_PATH=%%~dpi"
        goto :found_pg
    )
)
echo [ОШИБКА] PostgreSQL не найден!
pause
goto menu

:found_pg
echo [OK] PostgreSQL найден

if not exist "backups" mkdir backups

set "TIMESTAMP=%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "TIMESTAMP=%TIMESTAMP::=%"
set "BACKUP_FILE=backups\backup_%TIMESTAMP%.sql"

echo Создание резервной копии...
set "PGPASSWORD=%DB_PASSWORD%"
"%PG_PATH%pg_dump" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --format=plain --inserts > "%BACKUP_FILE%" 2>nul
set "PGPASSWORD="

if errorlevel 1 (
    echo [ОШИБКА] Не удалось создать резервную копию
) else (
    echo [ГОТОВО] Резервная копия создана!
    echo Файл: %BACKUP_FILE%
)
echo.
pause
goto menu