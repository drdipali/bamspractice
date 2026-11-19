@echo off
title BAMS Practice Builder - GitHub Pages Deployment
echo =======================================================
echo     BAMS Practice Builder - Deploy to GitHub Pages
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Git repository...
git status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Not a git repository.
    pause
    exit /b
)

echo.
git remote get-url origin >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Remote 'origin' is already linked:
    git remote -v
    echo.
    set /p PUSH_NOW="Do you want to push to this remote now? (Y/N): "
    if /i "%PUSH_NOW%"=="Y" goto DO_PUSH
)

echo [2/4] Linking GitHub Repository
echo Please create a new repository on GitHub (https://github.com/new).
echo Then paste your repository URL below.
echo Example: https://github.com/your-username/bams-practice.git
echo.
set /p REPO_URL="Enter GitHub Repository URL: "

if "%REPO_URL%"=="" (
    echo No repository URL provided. Aborting.
    pause
    exit /b
)

git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
echo Successfully linked origin to: %REPO_URL%

:DO_PUSH
echo.
echo [3/4] Pushing source code to GitHub (main branch)...
git branch -M main
git push -u origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Git push failed. Please check your GitHub credentials or repository permissions.
    pause
    exit /b
)

echo.
echo [4/4] Building and deploying web version to GitHub Pages...
call npm.cmd run deploy

echo.
echo =======================================================
echo  DEPLOYMENT COMPLETE!
echo  Your app will be live at:
echo  https://^<your-username^>.github.io/^<repo-name^>/
echo.
echo  It will run 24/7 in the cloud even when your laptop
echo  is closed or turned off!
echo =======================================================
pause
