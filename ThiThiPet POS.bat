@echo off
chcp 65001 >nul
title ThiThiPet POS
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0khoi-chay.ps1"
