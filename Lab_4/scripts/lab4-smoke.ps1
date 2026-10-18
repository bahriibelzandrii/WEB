$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$tmp = Join-Path $env:TEMP 'lab4-cookies.txt'
if (Test-Path $tmp) { Remove-Item -Force $tmp }

function req($method, $url, $data) {
  $a = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', $method, '-c', $tmp)
  if (Test-Path $tmp) { $a += @('-b', $tmp) }
  if ($null -ne $data) { $a += @('-d', $data) }
  $a += $url
  return (& curl.exe @a).Trim()
}
function req2($method, $url, $jar, $data) {
  $a = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', $method, '-c', $jar)
  if (Test-Path $jar) { $a += @('-b', $jar) }
  if ($null -ne $data) { $a += @('-d', $data) }
  $a += $url
  return (& curl.exe @a).Trim()
}
function body() {
  $a = @('-s')
  if (Test-Path $tmp) { $a += @('-b', $tmp) }
  $a += $args
  return (& curl.exe @a)
}
function check($name, $actual, $expected) {
  $mark = if ("$actual" -eq "$expected") { 'PASS' } else { 'FAIL' }
  Write-Output ("{0}  {1}  (got {2}, want {3})" -f $mark, $name, $actual, $expected)
}

# 1. guest
check 'guest GET /' (req GET "$base/" $null) 200
check 'guest GET /login' (req GET "$base/login" $null) 200
check 'guest GET /clients/new -> redirect' (req GET "$base/clients/new" $null) 302

# 2. bad password
check 'login bad password -> 401' (req POST "$base/login" 'email=admin@service.ua&password=wrong') 401

# 3. visitor
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'visitor login' (req POST "$base/login" 'email=visitor@service.ua&password=secret') 302
check 'visitor GET /' (req GET "$base/" $null) 200
check 'visitor GET /clients/new -> 403' (req GET "$base/clients/new" $null) 403
check 'visitor GET /requests/new -> 403' (req GET "$base/requests/new" $null) 403
$h = body "$base/"
if ($h -match 'role-badge' -and $h -match 'href="/logout"') { Write-Output 'PASS  visitor header: user chip + logout' } else { Write-Output 'FAIL  visitor header' }
check 'visitor logout' (req GET "$base/logout" $null) 302

# 4. technician
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'tech login' (req POST "$base/login" 'email=tech1@service.ua&password=secret') 302
check 'tech GET /requests' (req GET "$base/requests" $null) 200
check 'tech GET /requests/new -> 403' (req GET "$base/requests/new" $null) 403
check 'tech GET /clients/new -> 403' (req GET "$base/clients/new" $null) 403
check 'tech GET /works/new -> 403' (req GET "$base/works/new" $null) 403
check 'tech logout' (req GET "$base/logout" $null) 302

# 5. manager
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'manager login' (req POST "$base/login" 'email=manager@service.ua&password=secret') 302
check 'manager GET /clients/new' (req GET "$base/clients/new" $null) 200
check 'manager GET /requests/new' (req GET "$base/requests/new" $null) 200
check 'manager GET /works/new' (req GET "$base/works/new" $null) 200
check 'manager GET /parts/new' (req GET "$base/parts/new" $null) 200
check 'manager GET /devices/new' (req GET "$base/devices/new" $null) 200

# 6. admin
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'admin login' (req POST "$base/login" 'email=admin@service.ua&password=secret') 302
check 'admin GET /clients/new' (req GET "$base/clients/new" $null) 200
check 'admin GET /requests/new' (req GET "$base/requests/new" $null) 200
$ha = body "$base/"
if ($ha -match 'role-badge') { Write-Output 'PASS  admin header shows user chip' } else { Write-Output 'FAIL  admin header' }

# 7. register (unique email per run)
$ts = [int]([double]::Parse((Get-Date -UFormat %s)))
$regmail = "test.smoke.$ts@example.com"
$reg = Join-Path $env:TEMP 'lab4-reg-cookies.txt'
if (Test-Path $reg) { Remove-Item -Force $reg }
$r1 = req2 POST "$base/register" $reg "name=Test+User&email=$regmail&password=Secret123&password2=Secret123"
if ($r1 -eq '302') { Write-Output 'PASS  register new visitor -> 302' } else { Write-Output ("FAIL  register new visitor (got " + $r1 + ")") }
$r2 = req2 POST "$base/register" $reg "name=Test+User&email=$regmail&password=Secret123&password2=Secret123"
if ($r2 -eq '400') { Write-Output 'PASS  register duplicate email -> 400' } else { Write-Output ("FAIL  register duplicate (got " + $r2 + ")") }
$r3 = req2 GET "$base/clients/new" $reg $null
if ($r3 -eq '403') { Write-Output 'PASS  self-registered user is VISITOR (clients/new 403)' } else { Write-Output ("FAIL  self-registered role check (got " + $r3 + ")") }

# 8. 403 page content
Remove-Item $tmp -ErrorAction SilentlyContinue
req POST "$base/login" 'email=visitor@service.ua&password=secret' | Out-Null
$c403 = body "$base/clients/new"
if ($c403 -match '<h1>403</h1>') { Write-Output 'PASS  403 page rendered' } else { Write-Output 'FAIL  403 page content' }

Write-Output 'SMOKE-DONE'
