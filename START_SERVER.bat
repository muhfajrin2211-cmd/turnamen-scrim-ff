@echo off
title PAPIH GAMING - SERVER TURNAMEN FF
echo ========================================================
echo   MENJALANKAN SERVER TURNAMEN PAPIH GAMING
echo ========================================================
echo   Web Pendaftaran : http://localhost:8080
echo   Dashboard Admin  : http://localhost:8080/admin
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
