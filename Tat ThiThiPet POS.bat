@echo off
chcp 65001 >nul
title Tat ThiThiPet POS
echo.
echo   Dang tat tat ca tien trinh Node cua ThiThiPet POS...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "foreach ($p in 3000,5000) { Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | ForEach-Object { taskkill /PID $_.OwningProcess /T /F } }"
echo.
echo   Xong.
timeout /t 3 >nul
