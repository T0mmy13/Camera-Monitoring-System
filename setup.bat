@echo off
title CCTV System Setup

echo ========================================
echo CCTV Monitoring System - Setup
echo ========================================
echo.

REM 1. Проверка Python
echo [1/4] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found! Please install Python manually.
    echo.
    echo Download Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

python --version
echo.

REM 2. Создание venv
echo [2/4] Creating virtual environment...
if exist "venv" (
    echo Removing old virtual environment...
    rmdir /s /q venv
)

python -m venv venv
if %errorlevel% neq 0 (
    echo Failed to create virtual environment!
    pause
    exit /b 1
)
echo Virtual environment created!
echo.

REM 3. Установка зависимостей
echo [3/4] Installing dependencies...
call venv\Scripts\activate.bat

echo Updating pip...
python -m pip install --upgrade pip

echo.
echo Installing Flask...
pip install Flask

echo Installing Flask-CORS...
pip install Flask-CORS

echo Installing Flask-Login...
pip install Flask-Login

echo Installing openpyxl...
pip install openpyxl

echo Installing psycopg (PostgreSQL driver)...
pip install "psycopg[binary]"

echo Installing python-dotenv...
pip install python-dotenv

echo Installing bcrypt...
pip install bcrypt

echo.
echo [4/4] Verifying installation...
echo.
echo Installed packages:
pip list | findstr /i "Flask psycopg openpyxl bcrypt"

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo You can now run main.bat to start the application
echo.
pause