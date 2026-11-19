# BAMS Practice Builder - GitHub Pages Deployment Script
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "    BAMS Practice Builder - Deploy to GitHub Pages    " -ForegroundColor Cyan
Write-Host "    Repository: https://github.com/drdipali/bamspractice.git" -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

Set-Location $PSScriptRoot

Write-Host "`n[1/4] Configuring Git remote origin..." -ForegroundColor Green
git remote remove origin 2>$null
git remote add origin https://github.com/drdipali/bamspractice.git
Write-Host "Origin linked to https://github.com/drdipali/bamspractice.git" -ForegroundColor Green

Write-Host "`n[2/4] Pushing source code to GitHub (main branch)..." -ForegroundColor Green
git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Retrying git push with force in case remote has initial commits..." -ForegroundColor Yellow
    git push -u origin main --force
}

Write-Host "`n[3/4] Building production web package..." -ForegroundColor Green
npm.cmd run build:web

Write-Host "`n[4/4] Deploying to GitHub Pages branch (gh-pages)..." -ForegroundColor Green
npm.cmd run deploy

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host " DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host " Your app is live 24/7 at:" -ForegroundColor Yellow
Write-Host " https://drdipali.github.io/bamspractice/" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "=======================================================" -ForegroundColor Cyan
