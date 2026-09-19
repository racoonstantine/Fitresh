@echo off
setlocal
cd /d "%~dp0"
set "FOOD_VALIDATOR_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
echo Open http://127.0.0.1:8765 in your browser.
echo Keep this window open. Press Ctrl+C to stop the validator.
if exist "%FOOD_VALIDATOR_PY%" (
  "%FOOD_VALIDATOR_PY%" tools\food_validator.py
) else (
  python tools\food_validator.py
)
pause
