@echo off
chcp 65001 >nul
title Whale Pet
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
    where py >nul 2>nul && set "PY=py"
)
if not defined PY if exist "D:\develop\python.exe" set "PY=D:\develop\python.exe"
if not defined PY (
    echo Python not found. Please install Python first.
    pause
    exit /b
)
"%PY%" "%~dp0whale_pet.py" %*
if errorlevel 1 pause
