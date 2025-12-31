@echo off
echo Updating .env.local file with MongoDB Atlas connection string...
echo.

if "%MONGODB_URI%"=="" (
    echo ERROR: MONGODB_URI environment variable is not set
    echo.
    echo Please set MONGODB_URI before running this script:
    echo   set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
    echo.
    pause
    exit /b 1
)

echo NEXT_PUBLIC_APP_NAME=Job Application Copilot > .env.local
echo NEXTAUTH_SECRET=changeme-in-prod >> .env.local
echo MONGODB_URI=%MONGODB_URI% >> .env.local
echo JWT_SECRET=replace-with-strong-secret >> .env.local
echo JWT_EXPIRES_IN=7d >> .env.local
echo REDIS_URL=redis://localhost:6379 >> .env.local
echo OPENAI_API_KEY= >> .env.local
echo PLAYWRIGHT_HEADLESS=true >> .env.local
echo PLAYWRIGHT_CHROMIUM_PATH= >> .env.local

echo.
echo ✅ .env.local file created/updated successfully!
echo.
echo Please restart your dev server now:
echo   1. Stop current server (Ctrl+C)
echo   2. Run: pnpm dev
echo   3. Test login again
echo.
pause














