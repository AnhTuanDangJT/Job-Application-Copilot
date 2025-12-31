# PowerShell script to fix .env.local with MongoDB Atlas connection string

$envLocalPath = ".env.local"
$mongodbUri = "mongodb+srv://dganhtuan2k5_db_user:Johnnytext12345@cluster0.8wwd3vo.mongodb.net/job_app_copilot?retryWrites=true&w=majority&appName=Cluster0"

# Generate a secure JWT secret
Add-Type -AssemblyName System.Security
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
$jwtSecret = [Convert]::ToBase64String($bytes)

$content = @"
NEXT_PUBLIC_APP_NAME=Job Application Copilot
NEXTAUTH_SECRET=changeme-in-prod
MONGODB_URI=$mongodbUri
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_CHROMIUM_PATH=
"@

# Write the file
$content | Out-File -FilePath $envLocalPath -Encoding utf8 -NoNewline

Write-Host "✅ .env.local file created/updated successfully!"
Write-Host "✅ MongoDB Atlas URI configured"
Write-Host "✅ JWT_SECRET generated"
Write-Host ""
Write-Host "📋 Next steps:"
Write-Host "   1. Restart your dev server (stop and run 'pnpm dev' again)"
Write-Host "   2. Make sure your IP is whitelisted in MongoDB Atlas"
Write-Host "   3. Test login again"
Write-Host ""














