@echo off
title BAMS Practice Builder
echo ========================================================
echo   Launching BAMS Practice Builder (Web Server)
echo ========================================================
cd /d "%~dp0"
echo Opening browser at http://localhost:8081 ...
start "" http://localhost:8081
npx expo start --web --port 8081
