$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
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
function checkHas($name, $hay, $needle) {
  if ($hay -match [regex]::Escape($needle)) { Write-Output "PASS  $name" } else { Write-Output "FAIL  $name  (not found: $needle)" }
}
function checkNotHas($name, $hay, $needle) {
  if ($hay -notmatch [regex]::Escape($needle)) { Write-Output "PASS  $name" } else { Write-Output "FAIL  $name  (found: $needle)" }
}
function newJar($name) { $j = Join-Path $env:TEMP $name; if (Test-Path $j) { Remove-Item -Force $j }; $j }

# 1. guest: лендінг + редірект на логін
check 'guest GET / (лендінг)' (req GET "$base/" $null) 200
$h = body "$base/"
checkNotHas 'guest лендінг без user chip' $h 'role-badge'
checkHas 'guest лендінг: кнопка входу' $h '/login'
check 'guest GET /login' (req GET "$base/login" $null) 200
check 'guest GET /register' (req GET "$base/register" $null) 200
check 'guest GET /health' (req GET "$base/health" $null) 200
check 'guest GET /requests -> 302' (req GET "$base/requests" $null) 302
check 'guest GET /dashboard -> 302' (req GET "$base/dashboard" $null) 302
check 'guest GET /cabinet -> 302' (req GET "$base/cabinet" $null) 302
check 'guest GET /clients -> 302' (req GET "$base/clients" $null) 302

# 2. невірний пароль
check 'login bad password -> 401' (req POST "$base/login" 'email=admin@service.ua&password=wrong') 401

# 3. клієнт: тільки свої замовлення
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'client login' (req POST "$base/login" 'email=client@service.ua&password=Secret123') 302
check 'client GET / (редірект після логіну)' (req GET "$base/" $null) 302
check 'client GET /requests/my-orders' (req GET "$base/requests/my-orders" $null) 200
$ho = body "$base/requests/my-orders"
checkHas 'client my-orders: R-2026-0001' $ho 'R-2026-0001'
$ownId = [regex]::Match($ho, '/requests/([a-z0-9]+)">R-2026-0001').Groups[1].Value
# чужа заявка: перший id зі списку, який не є власним
$admJar = newJar 'lab4-admin-cookies.txt'
req2 POST "$base/login" $admJar 'email=admin@service.ua&password=Secret123' | Out-Null
$hA = & curl.exe -s -b $admJar "$base/requests"
$foreignId = ''
foreach ($m in [regex]::Matches($hA, '/requests/([a-z0-9]+)')) { $id = $m.Groups[1].Value; if ($id -ne $ownId) { $foreignId = $id; break } }
if ($foreignId -eq '') { Write-Output 'FAIL  foreign request id not found' } else {
  check 'client GET foreign request -> 403' (req GET "$base/requests/$foreignId" $null) 403
}
Remove-Item $admJar -ErrorAction SilentlyContinue
check 'client GET /requests -> 403' (req GET "$base/requests" $null) 403
check 'client GET /clients -> 403' (req GET "$base/clients" $null) 403
check 'client GET /dashboard -> 403' (req GET "$base/dashboard" $null) 403
check 'client GET /requests/new -> 403' (req GET "$base/requests/new" $null) 403
# власна картка: номер + фінанси, без приміток/робіт
$hc = body "$base/requests/$ownId"
checkHas 'client card: номер заявки' $hc 'R-2026-0001'
checkHas 'client card: секція оцінки/рахунку' $hc 'Оцінка та рахунок'
checkNotHas 'client card: без приміток' $hc 'Примітки'
checkNotHas 'client card: без робіт' $hc 'Виконані роботи'
check 'client GET /cabinet' (req GET "$base/cabinet" $null) 200
check 'client logout' (req GET "$base/logout" $null) 302

# 4. технік: лише свої, створює — в нього
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'tech login' (req POST "$base/login" 'email=tech1@service.ua&password=Secret123') 302
check 'tech GET /requests' (req GET "$base/requests" $null) 200
$ht = body "$base/requests?q=R-2026-0001"
checkHas 'tech index: своя R-2026-0001' $ht 'R-2026-0001'
$h4 = body "$base/requests?q=R-2026-0004"
checkNotHas 'tech index: без чужої R-2026-0004 (тех2)' $h4 'R-2026-0004'
check 'tech GET /requests/new' (req GET "$base/requests/new" $null) 200
check 'tech GET /clients/new' (req GET "$base/clients/new" $null) 200
check 'tech GET /works/new' (req GET "$base/works/new" $null) 200
check 'tech GET /dashboard' (req GET "$base/dashboard" $null) 200
check 'tech GET /cabinet' (req GET "$base/cabinet" $null) 200
check 'tech GET /requests/my-orders -> 403' (req GET "$base/requests/my-orders" $null) 403
check 'tech logout' (req GET "$base/logout" $null) 302

# 5. адмін: усе
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'admin login' (req POST "$base/login" 'email=admin@service.ua&password=Secret123') 302
check 'admin GET /requests' (req GET "$base/requests" $null) 200
$ha = body "$base/requests?q=R-2026-0001"
checkHas 'admin index: R-2026-0001' $ha 'R-2026-0001'
$hA4 = body "$base/requests?q=R-2026-0004"
checkHas 'admin index: R-2026-0004' $hA4 'R-2026-0004'
check 'admin GET /clients/new' (req GET "$base/clients/new" $null) 200
check 'admin GET /dashboard' (req GET "$base/dashboard" $null) 200
check 'admin GET /cabinet' (req GET "$base/cabinet" $null) 200
check 'admin GET /requests/my-orders -> 403' (req GET "$base/requests/my-orders" $null) 403

# 6. відвідувач: read-only
Remove-Item $tmp -ErrorAction SilentlyContinue
check 'visitor login' (req POST "$base/login" 'email=visitor@service.ua&password=Secret123') 302
check 'visitor GET /dashboard' (req GET "$base/dashboard" $null) 200
check 'visitor GET /requests' (req GET "$base/requests" $null) 200
check 'visitor GET /clients' (req GET "$base/clients" $null) 200
check 'visitor GET /requests/new -> 403' (req GET "$base/requests/new" $null) 403
check 'visitor GET /clients/new -> 403' (req GET "$base/clients/new" $null) 403
check 'visitor GET /cabinet' (req GET "$base/cabinet" $null) 200
$hv = body "$base/cabinet"
checkHas 'visitor cabinet: чип ролі' $hv 'role-badge'
check 'visitor logout' (req GET "$base/logout" $null) 302

# 7. кабінет: профіль + пароль (admin)
Remove-Item $tmp -ErrorAction SilentlyContinue
req POST "$base/login" 'email=admin@service.ua&password=Secret123' | Out-Null
check 'cabinet profile empty name -> 400' (req POST "$base/cabinet/profile" 'name=&email=admin%40service.ua&phone=') 400
check 'cabinet profile dup email -> 400' (req POST "$base/cabinet/profile" 'name=Адмін&email=tech1%40service.ua&phone=') 400
$okBody = "$env:TEMP\prof-ok-body.html"
$okCode = (& curl.exe -s -o $okBody -w '%{http_code}' -b $tmp -c $tmp -X POST -d ('name=' + [uri]::EscapeDataString('Адміністратор') + '&email=admin%40service.ua&phone=%2B380671234500') "$base/cabinet/profile").Trim()
check 'cabinet profile ok -> 302' $okCode 302
if ("$okCode" -ne '302') { $rr = [System.IO.File]::ReadAllText($okBody, [System.Text.Encoding]::UTF8); $ii = $rr.IndexOf('alert'); if ($ii -ge 0) { Write-Output ('DBG400: ' + $rr.Substring($ii, [Math]::Min(700, $rr.Length - $ii))) } else { Write-Output ('DBG400-body: ' + $rr.Substring(0, [Math]::Min(700, $rr.Length))) } }
check 'cabinet password wrong old -> 400' (req POST "$base/cabinet/password" 'currentPassword=nope12345&newPassword=NewPass123&confirmPassword=NewPass123') 400
check 'cabinet password mismatch -> 400' (req POST "$base/cabinet/password" 'currentPassword=Secret123&newPassword=NewPass123&confirmPassword=NewPass124') 400
check 'cabinet password ok -> 302' (req POST "$base/cabinet/password" 'currentPassword=Secret123&newPassword=NewPass123&confirmPassword=NewPass123') 302
check 'old password no more works -> 401' (req POST "$base/login" 'email=admin@service.ua&password=Secret123') 401
check 'new password works -> 302' (req POST "$base/login" 'email=admin@service.ua&password=NewPass123') 302
# повертаємо пароль із seed
check 'revert password -> 302' (req POST "$base/cabinet/password" 'currentPassword=NewPass123&newPassword=Secret123&confirmPassword=Secret123') 302
check 're-login seed password -> 302' (req POST "$base/login" 'email=admin@service.ua&password=Secret123') 302

# 8. реєстрація: новий відвідувач
$ts = [int]([double]::Parse((Get-Date -UFormat %s)))
$regmail = "test.smoke.$ts@example.com"
$reg = newJar 'lab4-reg-cookies.txt'
$r1 = req2 POST "$base/register" $reg "name=Test+User&email=$regmail&password=Secret123&password2=Secret123"
if ($r1 -eq '302') { Write-Output 'PASS  register new visitor -> 302' } else { Write-Output ("FAIL  register new visitor (got " + $r1 + ")") }
$r2 = req2 POST "$base/register" $reg "name=Test+User&email=$regmail&password=Secret123&password2=Secret123"
if ($r2 -eq '400') { Write-Output 'PASS  register duplicate email -> 400' } else { Write-Output ("FAIL  register duplicate (got " + $r2 + ")") }
$r3 = req2 GET "$base/clients/new" $reg $null
if ($r3 -eq '403') { Write-Output 'PASS  self-registered user is VISITOR (clients/new 403)' } else { Write-Output ("FAIL  self-registered role check (got " + $r3 + ")") }
$r4 = req2 GET "$base/dashboard" $reg $null
if ($r4 -eq '200') { Write-Output 'PASS  self-registered sees /dashboard read-only' } else { Write-Output ("FAIL  self-registered dashboard (got " + $r4 + ")") }

# 9. 403 сторінка
Remove-Item $tmp -ErrorAction SilentlyContinue
req POST "$base/login" 'email=visitor@service.ua&password=Secret123' | Out-Null
$c403 = body "$base/clients/new"
if ($c403 -match '<h1>403</h1>') { Write-Output 'PASS  403 page rendered' } else { Write-Output 'FAIL  403 page content' }

Write-Output 'SMOKE-DONE'
