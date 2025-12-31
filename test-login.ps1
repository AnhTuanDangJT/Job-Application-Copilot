# Test Login Script
Write-Output "Waiting for server to be ready..."
Start-Sleep -Seconds 15

$loginUrl = "http://localhost:3000/api/auth/login"
$body = @{
    email = "test@example.com"
    password = "testpassword123"
} | ConvertTo-Json

Write-Output "Attempting login to: $loginUrl"
Write-Output "Request body: $body"
Write-Output ""

try {
    $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Output "=== LOGIN SUCCESS ==="
    Write-Output ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Output "=== LOGIN ERROR ==="
    Write-Output "Error Type: $($_.Exception.GetType().FullName)"
    Write-Output "Error Message: $($_.Exception.Message)"
    
    if ($_.ErrorDetails) {
        Write-Output "Error Details: $($_.ErrorDetails.Message)"
    }
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Output "HTTP Status Code: $statusCode"
        
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            Write-Output "Response Body: $responseBody"
        } catch {
            Write-Output "Could not read response body: $($_.Exception.Message)"
        }
    }
}


