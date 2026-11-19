@echo off
title BAMS Practice Builder - GitHub Pages Deployment
echo =======================================================
echo     BAMS Practice Builder - Deploy to GitHub Pages
echo     Repository: https://github.com/drdipali/bamspractice.git
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/4] Configuring Git remote origin...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/drdipali/bamspractice.git
echo Remote linked to: https://github.com/drdipali/bamspractice.git

echo.
echo [2/4] Pushing source code to GitHub (main branch)...
git branch -M main
git push -u origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo If GitHub asks to sign in, please complete the login prompt.
    echo If the remote repository has initial files (README/License), retrying with force...
    git push -u origin main --force
)

echo.
echo [3/4] Building production web package...
call npm.cmd run build:web

echo.
echo [4/4] Deploying to GitHub Pages branch (gh-pages)...
call npm.cmd run deploy

echo.
echo =======================================================
echo  DEPLOYMENT COMPLETE!
echo.
echo  Your app will be live 24/7 at:
echo  https://drdipali.github.io/bamspractice/
echo.
echo  Note: In your GitHub repository settings (Settings -> Pages):
echo  Make sure "Source" is set to "Deploy from a branch" -> "gh-pages"
echo  (or "GitHub Actions").
echo =======================================================
pause
