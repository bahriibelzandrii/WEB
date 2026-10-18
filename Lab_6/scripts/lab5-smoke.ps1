# Lab 5 smoke: Lab 4 regression + role-aware UI + users module (curl + cookie jars)
# ASCII-only (PS 5.1 reads this file as ANSI); HTML probed by URL fragments.
$base = 'http://localhost:3000'
$tmp = Join-Path $env:TEMP 'lab5-jars'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
function Jar($n) { Join-Path $tmp $n }
$script:pass = 0
$script:fail = 0
function Check($name, $actual, $want) {
  if ("$actual" -eq $want) { Write-Output ('PASS  ' + $name); $script:pass++ }
  else { Write-Output ('FAIL  ' + $name + '  (got ' + $actual + ', want ' + $want + ')'); $script:fail++ }
}
function Code($url, $jar, $method, $body) {
  $args2 = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', $method)
  if ($jar) { $args2 += @('-b', $jar, '-c', $jar) }
  if ($body) { $args2 += @('-d', $body) }
  $args2 += @($base + $url)
  return (& curl.exe @args2)
}
function Body($url, $jar) {
  $out = Join-Path $tmp ('b-' + [guid]::NewGuid().ToString('N') + '.html')
  $args2 = @('-s', '-o', $out)
  if ($jar) { $args2 += @('-b', $jar, '-c', $jar) }
  $args2 += @($base + $url)
  & curl.exe @args2 | Out-Null
  return (Get-Content $out -Raw)
}
function Has($html, $needle) { return $html.Contains($needle) }
function Login($jar, $email) {
  Code '/login' $jar POST ('email=' + $email + '&password=secret') | Out-Null
}
function FindUserId($html, $email) {
  if ($html -match [regex]::Escape($email) + '[\s\S]{0,600}?/users/([a-zA-Z0-9-]+)/edit') { return $Matches[1] }
  return $null
}

# First request id (cuid, not "1")
$rid = $null
if ((Body '/requests' $null) -match 'href="/requests/([a-zA-Z0-9-]+)"') { $rid = $Matches[1] }
Check 'request id resolved' ('rid=' + $rid) ('rid=' + $rid)
$card = ('/requests/' + $rid)
$worksForm = ('action="' + $card + '/works"')
$statusFld = 'name="status"'
$warrForm  = ('action="' + $card + '/warranty"')
$editLink  = ('href="' + $card + '/edit"')

# ============ Lab 4 regression ============
Check 'guest GET /'                (Code '/' $null GET) '200'
Check 'guest GET /login'           (Code '/login' $null GET) '200'
Check 'guest GET /clients/new'     (Code '/clients/new' $null GET) '302'
Check 'login bad password'         (Code '/login' (Jar 'bad.txt') POST 'email=admin@service.ua&password=wrong') '401'

$v = Jar 'visitor.txt';  Login $v 'visitor@service.ua'
Check 'visitor GET /'              (Code '/' $v GET) '200'
Check 'visitor /clients/new 403'   (Code '/clients/new' $v GET) '403'
Check 'visitor /requests/new 403'  (Code '/requests/new' $v GET) '403'
Check 'visitor /users 403'         (Code '/users' $v GET) '403'

$t = Jar 'tech.txt';  Login $t 'tech1@service.ua'
Check 'tech /requests'             (Code '/requests' $t GET) '200'
Check 'tech /requests/new 403'     (Code '/requests/new' $t GET) '403'
Check 'tech /users 403'            (Code '/users' $t GET) '403'

$m = Jar 'mgr.txt';  Login $m 'manager@service.ua'
Check 'manager /clients/new'       (Code '/clients/new' $m GET) '200'
Check 'manager /requests/new'      (Code '/requests/new' $m GET) '200'
Check 'manager /users 403'         (Code '/users' $m GET) '403'

$a = Jar 'admin.txt';  Login $a 'admin@service.ua'
Check 'admin /users'               (Code '/users' $a GET) '200'
Check 'admin /users/new'           (Code '/users/new' $a GET) '200'

# ============ Lab 5: role-aware UI ============
$guestCard = (Body $card $null)
$gForms = (Has $guestCard $worksForm) -or (Has $guestCard $statusFld) -or (Has $guestCard $warrForm) -or (Has $guestCard $editLink)
Check 'guest card: no mutation UI' $gForms 'False'

$vCard = (Body $card $v)
$vForms = (Has $vCard $worksForm) -or (Has $vCard $statusFld) -or (Has $vCard $warrForm) -or (Has $vCard $editLink)
Check 'visitor card: no mutation UI' $vForms 'False'

$tCard = (Body $card $t)
$techOk = (Has $tCard $worksForm) -and (Has $tCard $statusFld) -and (-not (Has $tCard $warrForm)) -and (-not (Has $tCard $editLink))
Check 'tech card: work UI, no finance' $techOk 'True'

$mCard = (Body $card $m)
$mgrOk = (Has $mCard $warrForm) -and (Has $mCard $editLink)
Check 'manager card: finance + edit' $mgrOk 'True'

$vList = (Body '/clients' $v)
$mList = (Body '/clients' $m)
$btnOk = (-not (Has $vList 'href="/clients/new"')) -and (Has $mList 'href="/clients/new"')
Check 'clients list: new button by role' $btnOk 'True'

$guestNav = (Body '/' $null)
Check 'guest nav: no users link' (Has $guestNav 'href="/users"') 'False'
$adminNav = (Body '/' $a)
Check 'admin nav: users link'    (Has $adminNav 'href="/users"') 'True'

# ============ Lab 5: users module ============
Check 'POST /users create'         (Code '/users' $a POST 'name=Smoke+User&email=smoke.lab5@service.ua&role=VISITOR&password=smoke123') '302'
Check 'POST /users dup 400'        (Code '/users' $a POST 'name=Smoke+Dup&email=smoke.lab5@service.ua&role=VISITOR&password=smoke123') '400'
Check 'POST /users short pw 400'   (Code '/users' $a POST 'name=Smoke+Short&email=smoke.lab5b@service.ua&role=VISITOR&password=123') '400'

$list = (Body '/users' $a)
$uid = (FindUserId $list 'smoke.lab5@service.ua')
Check 'created user in list' ('uid=' + $uid) ('uid=' + $uid)
Check 'created user found'   ($null -eq $uid) 'False'

Check 'POST /users/:id/edit'   (Code ('/users/' + $uid + '/edit') $a POST 'name=Smoke+User&email=smoke.lab5@service.ua&role=TECHNICIAN&password=') '302'
$editForm = (Body ('/users/' + $uid + '/edit') $a)
Check 'edit form: role TECHNICIAN' (Has $editForm 'value="TECHNICIAN" selected') 'True'

$adminId = (FindUserId $list 'admin@service.ua')
Check 'self-delete 400'         (Code ('/users/' + $adminId + '/delete') $a POST '') '400'

Check 'POST /users/:id/delete'  (Code ('/users/' + $uid + '/delete') $a POST '') '302'
$list3 = (Body '/users' $a)
Check 'deleted user gone'       (Has $list3 'smoke.lab5@service.ua') 'False'

$techId = (FindUserId $list 'tech1@service.ua')
if ($techId) {
  Check 'FK-restricted delete 400' (Code ('/users/' + $techId + '/delete') $a POST '') '400'
} else {
  Check 'FK-restricted delete 400' 'tech-id-not-found' '400'
}

Write-Output ('PASS=' + $script:pass + ' FAIL=' + $script:fail)
if ($script:fail -gt 0) { exit 1 }
Write-Output 'LAB5-SMOKE-DONE'
