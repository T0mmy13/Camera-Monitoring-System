@echo off
title CCTV System

echo ========================================
echo CCTV Monitoring System
echo ========================================
echo.

REM Проверка наличия виртуального окружения
if not exist "venv" (
    echo Virtual environment not found!
    echo Please run setup.bat first to install required components.
    echo.
    pause
    exit /b 1
)

REM Активация виртуального окружения
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Запуск приложения
echo Starting server at http://localhost:5000
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python app.py

if %errorlevel% neq 0 (
    echo.
    echo Application crashed! Please check the error messages above.
    echo You may need to run setup.bat again.
    pause
)