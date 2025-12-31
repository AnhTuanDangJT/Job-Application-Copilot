@echo off
REM Alternative way to start dev server without PowerShell execution policy issues

echo Starting development server...
echo.

REM Try using npm if pnpm fails
where pnpm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using pnpm...
    call pnpm dev
) else (
    echo pnpm not found, trying npm...
    call npm run dev
)














