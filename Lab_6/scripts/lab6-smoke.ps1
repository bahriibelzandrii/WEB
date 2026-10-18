# Lab 6 smoke: REST /api (curl + cookie jars). ASCII-only (PS 5.1 reads ANSI).
# PS 5.1 mangles double quotes in native-cmd args, so bodies go via temp files.
$base = 'http://localhost:3000'
$tmp = Join-Path $env:TEMP 'lab6-jars'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
function Jar($n) { Join-Path $tmp $n }
$script:pass = 0
$script:fail = 0
function Check($name, $actual, $want) {
  if ("$actual" -eq $want) { Write-Output ('PASS  ' + $name); $script:pass++ }
  else { Write-Output ('FAIL  ' + $name + '  (got ' + $actual + ', want ' + $want + ')'); $script:fail++ }
}
function WriteBody($body) {
  $f = Join-Path $tmp ('d-' + [guid]::NewGuid().ToString('N') + '.json')
  Set-Content -Path $f -Value $body -Encoding ASCII -NoNewline
  return $f
}
# Web (form/urlencoded) request -> status code.
function Code($url, $jar, $method, $body) {
  $args2 = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', $method)
  if ($jar) { $args2 += @('-b', $jar, '-c', $jar) }
  if ($body) { $args2 += @('-d', ('@' + (WriteBody $body))) }
  $args2 += @($base + $url)
  return (& curl.exe @args2)
}
# API JSON request -> status code.
function ApiCode($url, $jar, $method, $body) {
  $args2 = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', $method)
  if ($jar) { $args2 += @('-b', $jar, '-c', $jar) }
  if ($body) { $args2 += @('-H', 'Content-Type: application/json', '--data-binary', ('@' + (WriteBody $body))) }
  $args2 += @($base + $url)
  return (& curl.exe @args2)
}
# API JSON POST -> @{code, body}.
function ApiPost($url, $jar, $body) {
  $out = Join-Path $tmp ('b-' + [guid]::NewGuid().ToString('N') + '.json')
  $args2 = @('-s', '-o', $out, '-w', '%{http_code}', '-X', 'POST')
  if ($jar) { $args2 += @('-b', $jar, '-c', $jar) }
  if ($body) { $args2 += @('-H', 'Content-Type: application/json', '--data-binary', ('@' + (WriteBody $body))) }
  $args2 += @($base + $url)
  $code = (& curl.exe @args2)
  return @{ code = $code; body = (Get-Content $out -Raw) }
}
function Body($url, $jar) {
  $out = Join-Path $tmp ('b-' + [guid]::NewGuid().ToString('N') + '.json')
  $args2 = @('-s', '-o', $out)
  if ($jar) { $args2 += @('-b', $jar, '-c', $jar) }
  $args2 += @($base + $url)
  & curl.exe @args2 | Out-Null
  return (Get-Content $out -Raw)
}
function Has($txt, $needle) { return $txt.Contains($needle) }
function FirstId($json) { if ($json -match '"data":\{"id":"([^"]+)"') { return $Matches[1] }; return $null }
function FirstListId($json) { if ($json -match '"data":\[{"id":"([^"]+)"') { return $Matches[1] }; return $null }
function Login($jar, $email) { Code '/login' $jar POST ('email=' + $email + '&password=secret') | Out-Null }

# Unique per run: web unique-checks also see soft-deleted rows from previous runs.
$tag = (Get-Date -Format 'HHmmss')
$a = Jar 'admin.txt'; $m = Jar 'manager.txt'; $t = Jar 'tech.txt'; $v = Jar 'visitor.txt'
Login $a 'admin@service.ua'; Login $m 'manager@service.ua'
Login $t 'tech1@service.ua'; Login $v 'visitor@service.ua'

# ============ Public reads (guest) ============
Check 'guest GET /api/requests'      (ApiCode '/api/requests' $null GET) '200'
Check 'guest GET /api/clients'       (ApiCode '/api/clients' $null GET) '200'
Check 'guest GET /api/users 401'     (ApiCode '/api/users' $null GET) '401'
Check 'guest POST /api/clients 401'  (ApiCode '/api/clients' $null POST '{}') '401'
Check 'guest 404 unknown route'      (ApiCode '/api/nope' $null GET) '404'
Check 'guest 404 unknown client'     (ApiCode '/api/clients/no-such-id' $null GET) '404'
$lst = (Body '/api/requests?pageSize=3' $null)
Check 'list envelope'                ((Has $lst '"totalPages"') -and (Has $lst '"pageSize":3')) 'True'
Check 'bad status filter 400'        (ApiCode '/api/requests?status=BOGUS' $null GET) '400'

# ============ References (cuids, resolved from JSON) ============
$workId = FirstListId (Body '/api/works?pageSize=1' $a)
$partId = FirstListId (Body '/api/parts?pageSize=1' $a)
$uj = (Body '/api/users' $a)
$techId = $null
if ($uj -match '"id":"([^"]+)","name":"[^"]*","email":"tech1@service\.ua"') { $techId = $Matches[1] }
Check 'tech user resolved'           ($techId -ne $null) 'True'

# ============ Role guards ============
Check 'visitor POST /api/clients 403' (ApiCode '/api/clients' $v POST ('{"name":"Nope","phone":"0671111111","email":"nope@x.ua"}')) '403'
Check 'visitor GET /api/users 403'    (ApiCode '/api/users' $v GET) '403'
Check 'manager GET /api/users 403'    (ApiCode '/api/users' $m GET) '403'
Check 'manager POST /api/users 403'   (ApiCode '/api/users' $m POST '{}') '403'
Check 'tech POST /api/clients 403'    (ApiCode '/api/clients' $t POST '{}') '403'

# ============ Clients CRUD (MANAGER+) ============
$cb = '{"name":"API Smoke LLC ' + $tag + '","phone":"0670000001","email":"smoke' + $tag + '@client.ua"}'
$r1 = ApiPost '/api/clients' $a $cb
Check 'admin POST /api/clients 201'  $r1.code '201'
$cid = FirstId $r1.body
Check 'client id resolved'           ($cid -ne $null) 'True'
Check 'client dup name 400'          (ApiCode '/api/clients' $a POST $cb) '400'
$rb = ApiPost '/api/clients' $a '{}'
Check 'client invalid 400'           $rb.code '400'
Check 'client invalid has errors'    (Has $rb.body '"errors"') 'True'
Check 'admin PUT /api/clients'       (ApiCode ('/api/clients/' + $cid) $a PUT ('{"name":"API Smoke LLC2 ' + $tag + '","phone":"0670000002","email":"smoke2' + $tag + '@client.ua"}')) '200'
Check 'client card updated'          (Has (Body ('/api/clients/' + $cid) $a) 'API Smoke LLC2') 'True'
Check 'manager POST /api/clients 201' (ApiCode '/api/clients' $m POST ('{"name":"Mgr Client ' + $tag + '","phone":"0673333333","email":"mgr' + $tag + '@client.ua"}')) '201'

# ============ Devices CRUD (MANAGER+) ============
$db = '{"type":"PC","brand":"Dell","model":"SmokeAPI ' + $tag + '","ownerId":"' + $cid + '"}'
$r2 = ApiPost '/api/devices' $a $db
Check 'admin POST /api/devices 201'  $r2.code '201'
$did = FirstId $r2.body
Check 'device 404 unknown'           (ApiCode '/api/devices/no-such' $a GET) '404'
Check 'admin DELETE /api/devices'    (ApiCode ('/api/devices/' + $did) $a DELETE) '204'
$db2 = '{"type":"LAPTOP","brand":"Lenovo","model":"SmokeAPI2 ' + $tag + '","ownerId":"' + $cid + '"}'
$r2b = ApiPost '/api/devices' $a $db2
Check 'admin POST /api/devices again' $r2b.code '201'
$did = FirstId $r2b.body

# ============ Request lifecycle (MANAGER+ / TECH+) ============
$reqb = '{"type":"REPAIR","priority":"NORMAL","description":"API smoke request","clientMode":"existing","clientId":"' + $cid + '","deviceMode":"existing","deviceId":"' + $did + '","technicianId":"' + $techId + '"}'
$r3 = ApiPost '/api/requests' $a $reqb
Check 'admin POST /api/requests 201' $r3.code '201'
$rid = FirstId $r3.body
Check 'request id resolved'          ($rid -ne $null) 'True'
Check 'request number format'        (Has $r3.body '"number":"R-') 'True'

Check 'tech transition 200'          (ApiCode ('/api/requests/' + $rid + '/transition') $t POST '{"status":"IN_DIAGNOSTICS"}') '200'
Check 'card status updated'          (Has (Body ('/api/requests/' + $rid) $a) '"status":"IN_DIAGNOSTICS"') 'True'
Check 'tech add work 201'            (ApiCode ('/api/requests/' + $rid + '/works') $t POST ('{"workId":"' + $workId + '"}')) '201'
Check 'tech add work invalid 400'    (ApiCode ('/api/requests/' + $rid + '/works') $t POST '{"workId":"no-such"}') '400'
Check 'visitor add work 403'         (ApiCode ('/api/requests/' + $rid + '/works') $v POST ('{"workId":"' + $workId + '"}')) '403'
Check 'tech add part 201'            (ApiCode ('/api/requests/' + $rid + '/parts') $t POST ('{"partId":"' + $partId + '","quantity":2,"unitPrice":"10.5"}')) '201'
Check 'tech add part dup 400'        (ApiCode ('/api/requests/' + $rid + '/parts') $t POST ('{"partId":"' + $partId + '","quantity":1,"unitPrice":"5"}')) '400'
Check 'tech add part qty invalid 400' (ApiCode ('/api/requests/' + $rid + '/parts') $t POST ('{"partId":"' + $partId + '","quantity":0,"unitPrice":"5"}')) '400'
$card = (Body ('/api/requests/' + $rid) $a)
$wline = $null; $pline = $null
if ($card -match '"works":\[{"id":"([^"]+)"') { $wline = $Matches[1] }
if ($card -match '"parts":\[{"id":"([^"]+)"') { $pline = $Matches[1] }
Check 'work line resolved'           ($wline -ne $null) 'True'
Check 'tech remove work 204'         (ApiCode ('/api/requests/' + $rid + '/works/' + $wline) $t DELETE) '204'

Check 'tech diagnostics 200'         (ApiCode ('/api/requests/' + $rid + '/diagnostics') $t POST '{"findings":"API smoke findings","cost":"5","notes":"n"}') '200'
Check 'manager add work 201'         (ApiCode ('/api/requests/' + $rid + '/works') $m POST ('{"workId":"' + $workId + '"}')) '201'
Check 'manager estimate 200'         (ApiCode ('/api/requests/' + $rid + '/estimate') $m POST '{}') '200'
Check 'tech estimate 403'            (ApiCode ('/api/requests/' + $rid + '/estimate') $t POST '{}') '403'
Check 'manager approve 200'          (ApiCode ('/api/requests/' + $rid + '/estimate/approve') $m POST '{}') '200'
Check 'manager invoice 201'          (ApiCode ('/api/requests/' + $rid + '/invoice') $m POST '{"discount":0}') '201'
Check 'manager invoice again 400'    (ApiCode ('/api/requests/' + $rid + '/invoice') $m POST '{"discount":0}') '400'
Check 'manager payment 201'          (ApiCode ('/api/requests/' + $rid + '/payments') $m POST '{"amount":5.25,"method":"CASH","note":"partial"}') '201'
Check 'manager payment overpay 400'  (ApiCode ('/api/requests/' + $rid + '/payments') $m POST '{"amount":999999,"method":"CASH"}') '400'
$card2 = (Body ('/api/requests/' + $rid) $a)
$remaining = $null
if ($card2 -match '"finalTotal":"?([0-9.]+)') { $remaining = $Matches[1] }
# pay the rest: finalTotal - the one partial payment (5.25); invariant culture for JSON
$payTxt = ([decimal]$remaining - 5.25).ToString([System.Globalization.CultureInfo]::InvariantCulture)
$pr = ApiPost ('/api/requests/' + $rid + '/payments') $m ('{"amount":' + $payTxt + ',"method":"CARD"}')
Check 'manager pay rest 201'         $pr.code '201'
$card3 = (Body ('/api/requests/' + $rid) $a)
Check 'invoice PAID'                 (Has $card3 '"status":"PAID"') 'True'
Check 'manager warranty 200'         (ApiCode ('/api/requests/' + $rid + '/warranty') $m POST '{"periodDays":90,"scope":"API smoke"}') '200'
Check 'manager warranty invalid 400' (ApiCode ('/api/requests/' + $rid + '/warranty') $m POST '{"periodDays":7}') '400'
Check 'tech comment 201'             (ApiCode ('/api/requests/' + $rid + '/comments') $t POST '{"text":"API smoke comment"}') '201'
$att = Join-Path $tmp 'smoke.txt'
Set-Content -Path $att -Value 'lab6 api smoke attachment' -Encoding ASCII -NoNewline
$margs = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', 'POST', '-b', $t, '-c', $t, '-F', ('file=@' + $att), ($base + '/api/requests/' + $rid + '/attachments'))
Check 'tech upload attachment 201'   (& curl.exe @margs) '201'

# ============ Users (ADMIN) ============
Check 'admin GET /api/users 200'     (ApiCode '/api/users' $a GET) '200'
Check 'users json without password'  (Has $uj '"password"') 'False'
$ub = '{"name":"API Smoke User ' + $tag + '","email":"smoke.api.' + $tag + '@service.ua","phone":"0672222222","role":"VISITOR","password":"smoke123"}'
$ru = ApiPost '/api/users' $a $ub
Check 'admin POST /api/users 201'    $ru.code '201'
$uid = FirstId $ru.body
Check 'user id resolved'             ($uid -ne $null) 'True'
Check 'user dup email 400'           (ApiCode '/api/users' $a POST $ub) '400'
Check 'user short password 400'      (ApiCode '/api/users' $a POST '{"name":"Short","email":"short@service.ua","role":"VISITOR","password":"123"}') '400'
Check 'admin PUT /api/users'         (ApiCode ('/api/users/' + $uid) $a PUT ('{"name":"API Smoke User2 ' + $tag + '","email":"smoke.api.' + $tag + '@service.ua","role":"TECHNICIAN"}')) '200'
Check 'user FK-restrict delete 400'  (ApiCode ('/api/users/' + $techId) $a DELETE) '400'
Check 'admin DELETE /api/users 204'  (ApiCode ('/api/users/' + $uid) $a DELETE) '204'

# ============ Cleanup + Web regression ============
Check 'admin DELETE /api/requests'   (ApiCode ('/api/requests/' + $rid) $a DELETE) '204'
Check 'deleted request 404'          (ApiCode ('/api/requests/' + $rid) $a GET) '404'
Check 'admin DELETE /api/clients'    (ApiCode ('/api/clients/' + $cid) $a DELETE) '204'
Check 'deleted client 404'           (ApiCode ('/api/clients/' + $cid) $a GET) '404'
Check 'web /login 200'               (Code '/login' $null GET) '200'
Check 'web admin /users 200'         (Code '/users' $a GET) '200'
Check 'web /requests 200'            (Code '/requests' $null GET) '200'

Write-Output ('LAB6-SMOKE: ' + $script:pass + ' passed, ' + $script:fail + ' failed')
Write-Output 'LAB6-SMOKE-DONE'
