#!/usr/bin/env pwsh
# RadFast Admin — local pen-test smoke script.
# Usage:
#   ./security/pen-test.ps1                 # default http://localhost:9000
#   ./security/pen-test.ps1 -BaseUrl https://admin.example.com

param(
  [string]$BaseUrl = 'http://localhost:9000'
)

$ErrorActionPreference = 'Continue'
$pass = 0
$fail = 0

function Test-Case {
  param([string]$Name, [scriptblock]$Block)
  Write-Host "─ $Name" -ForegroundColor Cyan
  try {
    $ok = & $Block
    if ($ok) { $script:pass++; Write-Host "  ✅ PASS`n" -ForegroundColor Green }
    else     { $script:fail++; Write-Host "  ❌ FAIL`n" -ForegroundColor Red }
  } catch {
    $script:fail++
    Write-Host "  ❌ ERROR: $_`n" -ForegroundColor Red
  }
}

function Invoke-Status {
  param([string]$Path, [string]$Method = 'GET', $Body = $null, [hashtable]$Headers = @{})
  $params = @{
    Uri                = "$BaseUrl$Path"
    Method             = $Method
    SkipHttpErrorCheck = $true
    Headers            = $Headers
    UseBasicParsing    = $true
  }
  if ($Body) {
    $params.Body        = $Body
    $params.ContentType = 'application/json'
  }
  $r = Invoke-WebRequest @params
  return @{ Status = [int]$r.StatusCode; Body = [string]$r.Content; Headers = $r.Headers }
}

function Get-Headers($path) { (Invoke-Status -Path $path).Headers }

function Try-Login($user, $pwd) {
  $body = @{ username = $user; password = $pwd } | ConvertTo-Json -Compress
  Invoke-Status -Path '/api/auth/login' -Method POST -Body $body
}

Write-Host "`n🔍 RadFast Pen-Test — target: $BaseUrl`n" -ForegroundColor Yellow

# ═══ Headers ═══════════════════════════════════════════════════════════════
Test-Case 'Helmet CSP header present' {
  (Get-Headers '/api/health').'Content-Security-Policy' -ne $null
}
Test-Case 'X-Frame-Options DENY' {
  (Get-Headers '/api/health').'X-Frame-Options' -contains 'DENY'
}
Test-Case 'X-Content-Type-Options nosniff' {
  (Get-Headers '/api/health').'X-Content-Type-Options' -contains 'nosniff'
}
Test-Case 'X-Powered-By absent' {
  $null -eq (Get-Headers '/api/health').'X-Powered-By'
}
Test-Case 'Cross-Origin-Opener-Policy set' {
  (Get-Headers '/api/health').'Cross-Origin-Opener-Policy' -ne $null
}

# ═══ Auth bypass / injection attempts ══════════════════════════════════════
Test-Case 'Login rejects SQL/NoSQL injection in username' {
  $r = Try-Login "admin' OR 1=1--" 'whatever'
  $r.Status -in @(400, 401, 429)
}
Test-Case 'Login rejects oversize payload' {
  $r = Try-Login 'admin' ('A' * 300)
  $r.Status -in @(400, 401, 429)
}
Test-Case 'Login rejects path traversal in username' {
  $r = Try-Login '../../etc/passwd' 'x'
  $r.Status -in @(400, 401, 429)
}
Test-Case 'Login rejects null byte' {
  $r = Try-Login "admin`0evil" 'x'
  $r.Status -in @(400, 401, 429)
}

# ═══ JWT validation ════════════════════════════════════════════════════════
Test-Case 'Missing Authorization rejected with 401' {
  (Invoke-Status -Path '/api/instances').Status -eq 401
}
Test-Case 'Invalid Bearer token rejected' {
  $r = Invoke-Status -Path '/api/auth/me' -Headers @{Authorization = 'Bearer bogus.token.value'}
  $r.Status -eq 401
}
Test-Case 'Algorithm-confusion (alg=none) rejected' {
  $tok = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.'
  $r = Invoke-Status -Path '/api/auth/me' -Headers @{Authorization = "Bearer $tok"}
  $r.Status -eq 401
}
Test-Case 'Oversize JWT (5 KB) rejected' {
  $tok = 'A' * 5000
  $r = Invoke-Status -Path '/api/auth/me' -Headers @{Authorization = "Bearer $tok"}
  $r.Status -eq 401
}

# ═══ CSRF & methods ════════════════════════════════════════════════════════
Test-Case 'POST without CSRF token rejected (401 or 403)' {
  $r = Invoke-Status -Path '/api/instances' -Method POST -Body '{}'
  $r.Status -in @(401, 403)
}
Test-Case 'POST /api/auth/logout without auth rejected' {
  # CSRF middleware runs before auth on POST; either 401 (no token) or 403 (no CSRF) is acceptable.
  $r = Invoke-Status -Path '/api/auth/logout' -Method POST -Body '{}'
  $r.Status -in @(401, 403)
}
Test-Case '404 returns JSON (no stack trace leakage)' {
  $r = Invoke-Status -Path '/api/does-not-exist'
  $r.Status -eq 404 -and $r.Body -notmatch '\.js:\d+|at \w+ \('
}

# ═══ Rate limit ════════════════════════════════════════════════════════════
Test-Case 'Login rate limiter triggers within 8 wrong attempts' {
  $hit429 = $false
  for ($i = 0; $i -lt 8; $i++) {
    $r = Try-Login 'admin' "wrong-$i"
    if ($r.Status -eq 429) { $hit429 = $true; break }
  }
  $hit429
}

# ═══ Cookie hygiene ════════════════════════════════════════════════════════
Test-Case 'CSRF bootstrap cookie present' {
  $r = Invoke-Status -Path '/api/auth/csrf'
  ($r.Headers.'Set-Cookie' | Out-String) -match 'XSRF-TOKEN'
}

# ═══ Summary ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══════════════════════════════════════"
Write-Host "  Result: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "═══════════════════════════════════════"

if ($fail -gt 0) { exit 1 }
