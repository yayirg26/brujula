@echo off
title KPI Dashboard - servidor local
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
pause
