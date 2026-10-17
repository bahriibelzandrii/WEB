#!/bin/bash
# Lab 3 E2E — форми + серверна валідація + видалення. Запуск: sh scripts/lab3-e2e.sh
# ВАЖЛИВО: дані curl -d — percent-encoded ASCII (Git-Bash ламає UTF-8 в argv нативного curl).
B=http://localhost:3000
P=0; F=0
ck() {
  if [ "$2" = "$3" ]; then
    P=$((P+1))
  else
    F=$((F+1))
    echo "FAIL: $1 (expect [$2], got [$3])"
  fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
body() { curl -s "$@"; }
postloc() {
  curl -s -D - -o /dev/null -X POST "$1" -d "$2" | tr -d '\r' | awk '
    /^HTTP\// { c = $2 }
    tolower($1) == "location:" { l = $2 }
    END { print c, l }'
}

echo "== health =="
ck "GET /health" "200" "$(code $B/health)"

echo "== CLIENTS =="
H=$(body $B/clients/new)
ck "GET /clients/new 200" "200" "$(code $B/clients/new)"
ck "create form has no required" "0" "$(echo "$H" | grep -c 'required')"
R=$(body -X POST $B/clients -d "name=&phone=&email=&address=&notes=")
ck "POST empty -> 400" "400" "$(code -X POST $B/clients -d 'name=&phone=&email=&address=&notes=')"
ck "empty: name error" "1" "$(echo "$R" | grep -c "Вкажіть ім'я / назву")"
ck "empty: phone error" "1" "$(echo "$R" | grep -c "Вкажіть телефон")"
ck "values preserved (name)" "1" "$(echo "$R" | grep -c 'name="name"')"
R=$(body -X POST $B/clients -d "name=%D0%A2%D0%B5%D1%81%D1%82&phone=%D0%B0%D0%B1%D0%B2&email=notanemail&address=&notes=")
ck "bad phone -> 400" "400" "$(code -X POST $B/clients -d 'name=%D0%A2%D0%B5%D1%81%D1%82&phone=%D0%B0%D0%B1%D0%B2&email=notanemail&address=&notes=')"
ck "phone format error" "1" "$(echo "$R" | grep -c "+380 + 9 цифр")"
ck "email format error" "1" "$(echo "$R" | grep -c "Email: некоректний формат")"
ck "short phone -> 400" "400" "$(code -X POST $B/clients -d 'name=%D0%A2%D0%B5%D1%81%D1%82&phone=%2B3801234567')"
ck "long phone -> 400" "400" "$(code -X POST $B/clients -d 'name=%D0%A2%D0%B5%D1%81%D1%82&phone=%2B3806712345012')"
ck "short name -> 400" "400" "$(code -X POST $B/clients -d 'name=%D0%90&phone=%2B380671234501')"
R=$(body -X POST $B/clients -d "name=%D0%90&phone=%2B380671234501")
ck "short name msg" "1" "$(echo "$R" | grep -c "Ім'я / назва: мінімум 2 символи")"
LONG=$(head -c 320 /dev/zero | tr '\0' 'a')
ck "long email -> 400" "400" "$(code -X POST $B/clients -d "name=%D0%A2%D0%B5%D1%81%D1%82&phone=%2B380671234501&email=${LONG}%40example.com")"
R=$(body -X POST $B/clients -d "name=%D0%A2%D0%B5%D1%81%D1%82&phone=%2B380671234501&email=${LONG}%40example.com")
ck "long email msg" "1" "$(echo "$R" | grep -c "Email: до 320 символів")"
LOC=$(postloc $B/clients "name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B8%D0%B9%20%D0%9A%D0%BB%D1%96%D1%94%D0%BD%D1%82%20L3&phone=%2B380671112233&email=l3.test@example.com&address=%D0%BC.%20%D0%9A%D0%B8%D1%97%D0%B2%2C%20%D0%B2%D1%83%D0%BB.%20%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%2C%201&notes=%D1%81%D1%82%D0%B2%D0%BE%D1%80%D0%B5%D0%BD%D0%BE%20%D1%82%D0%B5%D1%81%D1%82%D0%BE%D0%BC")
ck "POST valid -> 302" "302" "$(echo $LOC | cut -d' ' -f1)"
NEWC="$B$(echo $LOC | cut -d' ' -f2)"
echo "   created: $NEWC"
body $NEWC | grep -q "Тестовий Клієнт L3" && HAS=1 || HAS=0
ck "card shows new client" "1" "$HAS"
LOC_LOCAL=$(curl -s -o /dev/null -w "%{http_code}" -X POST $B/clients -d "name=%D0%9A%D0%BB%D1%96%D1%94%D0%BD%D1%82%20067&phone=0671234501&email=client067%40example.com")
ck "local phone valid -> 302" "302" "$LOC_LOCAL"
R=$(body -X POST $B/clients -d "name=%D0%94%D1%83%D0%B1%D0%BB%D1%8C&phone=%2B380671112234&email=l3.test@example.com")
ck "dup email -> 400" "400" "$(code -X POST $B/clients -d 'name=%D0%94%D1%83%D0%B1%D0%BB%D1%8C&phone=%2B380671112234&email=l3.test@example.com')"
ck "dup email msg" "1" "$(echo "$R" | grep -c "Email вже використовується іншим клієнтом")"
CEDIT=$(body $NEWC/edit)
ck "GET edit 200" "200" "$(code $NEWC/edit)"
ck "edit prefilled name" "1" "$(echo "$CEDIT" | grep -c 'value="Тестовий Клієнт L3"')"
ck "edit no required" "0" "$(echo "$CEDIT" | grep -c 'required')"
LOC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $NEWC/edit -d "name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B8%D0%B9%20%D0%9A%D0%BB%D1%96%D1%94%D0%BD%D1%82%20L3%20%28%D0%BE%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%BE%29&phone=%2B380671112233&email=l3.test@example.com&address=%D0%BC.%20%D0%9A%D0%B8%D1%97%D0%B2%2C%20%D0%B2%D1%83%D0%BB.%20%D0%9D%D0%BE%D0%B2%D0%B0%2C%202&notes=")
ck "POST edit valid -> 302" "302" "$LOC"
body $NEWC | grep -q "оновлено" && HAS=1 || HAS=0
ck "edit saved" "1" "$HAS"
R=$(body -X POST $NEWC/edit -d "name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B8%D0%B9%20%D0%9A%D0%BB%D1%96%D1%94%D0%BD%D1%82%20L3%20%28%D0%BE%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%BE%29&phone=%2B380671112233&email=p.shevchenko@example.com")
ck "edit dup email -> 400" "400" "$(code -X POST $NEWC/edit -d 'name=X&phone=%2B380671112233&email=p.shevchenko@example.com')"
ck "edit dup email msg" "1" "$(echo "$R" | grep -c "Email вже використовується іншим клієнтом")"

echo "== DEVICES =="
H=$(body $B/devices/new)
ck "GET /devices/new 200" "200" "$(code $B/devices/new)"
ck "devices create no required" "0" "$(echo "$H" | grep -c 'required')"
R=$(body -X POST $B/devices -d "type=&brand=&model=&serialNumber=&specs=&purchasedAt=&ownerId=")
ck "POST empty -> 400" "400" "$(code -X POST $B/devices -d 'type=&brand=&model=&ownerId=')"
ck "type error" "1" "$(echo "$R" | grep -c "Оберіть тип пристрою")"
ck "brand error" "1" "$(echo "$R" | grep -c "Вкажіть бренд")"
ck "model error" "1" "$(echo "$R" | grep -c "Вкажіть модель")"
ck "owner error" "1" "$(echo "$R" | grep -c "Оберіть власника (клієнта)")"
OID=$(echo $NEWC | sed 's/.*\///')
ck "short brand -> 400" "400" "$(code -X POST $B/devices -d "type=PC&brand=A&model=M1&ownerId=$OID")"
R=$(body -X POST $B/devices -d "type=PC&brand=A&model=M1&ownerId=$OID")
ck "short brand msg" "1" "$(echo "$R" | grep -c "Бренд: мінімум 2 символи")"
R=$(body -X POST $B/devices -d "type=PC&brand=Test&model=M1&ownerId=$OID&purchasedAt=2099-01-01")
ck "future date -> 400" "400" "$(code -X POST $B/devices -d "type=PC&brand=Test&model=M1&ownerId=$OID&purchasedAt=2099-01-01")"
ck "future date msg" "1" "$(echo "$R" | grep -c "не може бути в майбутньому")"
R=$(body -X POST $B/devices -d "type=PC&brand=Test&model=M1&ownerId=$OID&purchasedAt=13.05.2020")
ck "bad date fmt -> 400" "400" "$(code -X POST $B/devices -d "type=PC&brand=Test&model=M1&ownerId=$OID&purchasedAt=13.05.2020")"
ck "bad date msg" "1" "$(echo "$R" | grep -c "некоректний формат (YYYY-MM-DD)")"
R=$(body -X POST $B/devices -d "type=PC&brand=Test&model=M1&ownerId=$OID&purchasedAt=1989-01-01")
ck "date pre-1990 -> 400" "400" "$(code -X POST $B/devices -d "type=PC&brand=Test&model=M1&ownerId=$OID&purchasedAt=1989-01-01")"
ck "date pre-1990 msg" "1" "$(echo "$R" | grep -c "не може бути раніше 1990 року")"
LOC=$(postloc $B/devices "type=LAPTOP&brand=TestBook&model=L3-500&serialNumber=SN-L3-001&specs=i5/16GB&ownerId=$OID&purchasedAt=2024-05-01")
ck "POST valid -> 302" "302" "$(echo $LOC | cut -d' ' -f1)"
NEWD="$B$(echo $LOC | cut -d' ' -f2)"
echo "   created: $NEWD"
body $NEWD | grep -q "TestBook" && HAS=1 || HAS=0
ck "device card shows" "1" "$HAS"
DEDIT=$(body $NEWD/edit)
ck "GET device edit 200" "200" "$(code $NEWD/edit)"
ck "edit prefilled brand" "1" "$(echo "$DEDIT" | grep -c 'value="TestBook"')"
ck "edit date prefilled" "1" "$(echo "$DEDIT" | grep -c 'value="2024-05-01"')"
LOC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $NEWD/edit -d "type=LAPTOP&brand=TestBook%20Pro&model=L3-500&serialNumber=SN-L3-001&specs=i7/32GB&ownerId=$OID&purchasedAt=2024-05-01")
ck "POST device edit -> 302" "302" "$LOC"

echo "== WORKS =="
H=$(body $B/works/new)
ck "GET /works/new 200" "200" "$(code $B/works/new)"
ck "works create no required" "0" "$(echo "$H" | grep -c 'required')"
R=$(body -X POST $B/works -d "name=&description=&basePrice=&baseHours=")
ck "POST empty -> 400" "400" "$(code -X POST $B/works -d 'name=&basePrice=&baseHours=')"
ck "name error" "1" "$(echo "$R" | grep -c "Вкажіть назву роботи")"
ck "price error" "1" "$(echo "$R" | grep -c "Вкажіть базову ціну (число)")"
ck "hours error" "1" "$(echo "$R" | grep -c "Вкажіть тривалість у годинах (число)")"
R=$(body -X POST $B/works -d "name=%D0%A2%D0%B5%D1%81%D1%82%20%D1%80%D0%BE%D0%B1%D0%BE%D1%82%D0%B0&basePrice=-5&baseHours=0")
ck "neg price -> 400" "400" "$(code -X POST $B/works -d 'name=%D0%A2%D0%B5%D1%81%D1%82%20%D1%80%D0%BE%D0%B1%D0%BE%D1%82%D0%B0&basePrice=-5&baseHours=0')"
ck "neg price msg" "1" "$(echo "$R" | grep -c "Базова ціна має бути більшою за 0")"
ck "hours>0 msg" "1" "$(echo "$R" | grep -c "більшою за 0")"
R=$(body -X POST $B/works -d "name=%D0%A2%D0%B5%D1%81%D1%82%20%D1%80%D0%BE%D0%B1%D0%BE%D1%82%D0%B0&basePrice=abc&baseHours=2")
ck "non-numeric price -> 400" "400" "$(code -X POST $B/works -d 'name=%D0%A2%D0%B5%D1%81%D1%82%20%D1%80%D0%BE%D0%B1%D0%BE%D1%82%D0%B0&basePrice=abc&baseHours=2')"
ck "zero price -> 400" "400" "$(code -X POST $B/works -d 'name=%D0%A2%D0%B5%D1%81%D1%82&basePrice=0&baseHours=1')"
ck "price 3 decimals -> 400" "400" "$(code -X POST $B/works -d 'name=%D0%A2%D0%B5%D1%81%D1%82&basePrice=12.999&baseHours=1')"
R=$(body -X POST $B/works -d "name=%D0%A2%D0%B5%D1%81%D1%82&basePrice=12.999&baseHours=1")
ck "price 3 decimals msg" "1" "$(echo "$R" | grep -c "не більше 2 знаків після коми")"
ck "hours 3 decimals -> 400" "400" "$(code -X POST $B/works -d 'name=%D0%A2%D0%B5%D1%81%D1%82&basePrice=100&baseHours=1.255')"
R=$(body -X POST $B/works -d "name=%D0%A2%D0%B5%D1%81%D1%82&basePrice=100&baseHours=1.255")
ck "hours 3 decimals msg" "1" "$(echo "$R" | grep -c "не більше 2 знаків після коми")"
LOC=$(postloc $B/works "name=%D0%97%D0%B0%D0%BC%D1%96%D0%BD%D0%B0%20%D1%82%D0%B5%D1%80%D0%BC%D0%BE%D0%BF%D0%B0%D1%81%D1%82%D0%BE%D1%8E%20L3&description=%D1%82%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%20%D0%BF%D0%BE%D0%B7%D0%B8%D1%86%D1%96%D1%8F&basePrice=450.50&baseHours=1.5")
ck "POST valid -> 302" "302" "$(echo $LOC | cut -d' ' -f1)"
body $B/works | grep -q "Заміна термопастою L3" && HAS=1 || HAS=0
ck "works list shows new" "1" "$HAS"
R=$(body -X POST $B/works -d "name=%D0%97%D0%B0%D0%BC%D1%96%D0%BD%D0%B0%20%D1%82%D0%B5%D1%80%D0%BC%D0%BE%D0%BF%D0%B0%D1%81%D1%82%D0%BE%D1%8E%20L3&basePrice=100&baseHours=1")
ck "dup name -> 400" "400" "$(code -X POST $B/works -d 'name=%D0%97%D0%B0%D0%BC%D1%96%D0%BD%D0%B0%20%D1%82%D0%B5%D1%80%D0%BC%D0%BE%D0%BF%D0%B0%D1%81%D1%82%D0%BE%D1%8E%20L3&basePrice=100&baseHours=1')"
ck "dup name msg" "1" "$(echo "$R" | grep -c "Робота з такою назвою вже існує")"
NEWW=$(curl -s $B/works | tr -d '\n' | grep -oE 'Заміна термопастою L3</td>.{0,500}' | grep -oE '/works/[a-z0-9]+/edit' | head -1 | sed 's|/works/||;s|/edit||')
echo "   work id: $NEWW"
WEDIT=$(body $B/works/$NEWW/edit)
ck "GET work edit 200" "200" "$(code $B/works/$NEWW/edit)"
ck "work edit prefilled price" "1" "$(echo "$WEDIT" | grep -c 'value="450.5"')"
LOC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $B/works/$NEWW/edit -d "name=%D0%97%D0%B0%D0%BC%D1%96%D0%BD%D0%B0%20%D1%82%D0%B5%D1%80%D0%BC%D0%BE%D0%BF%D0%B0%D1%81%D1%82%D0%BE%D1%8E%20L3&description=%D0%BE%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%BE%20%D1%82%D0%B5%D1%81%D1%82%D0%BE%D0%BC&basePrice=500&baseHours=2")
ck "POST work edit -> 302" "302" "$LOC"
body $B/works | grep -q "оновлено тестом" && HAS=1 || HAS=0
ck "work edit saved" "1" "$HAS"
R=$(body -X POST $B/works/$NEWW/edit -d "name=%D0%94%D1%96%D0%B0%D0%B3%D0%BD%D0%BE%D1%81%D1%82%D0%B8%D0%BA%D0%B0&basePrice=100&baseHours=1")
ck "edit->dup name 400" "400" "$(code -X POST $B/works/$NEWW/edit -d 'name=%D0%94%D1%96%D0%B0%D0%B3%D0%BD%D0%BE%D1%81%D1%82%D0%B8%D0%BA%D0%B0&basePrice=100&baseHours=1')"
ck "edit dup name msg" "1" "$(echo "$R" | grep -c "Робота з такою назвою вже існує")"

echo "== PARTS =="
H=$(body $B/parts)
ck "GET /parts 200" "200" "$(code $B/parts)"
ck "parts list has 15 rows" "15" "$(echo "$H" | grep -o 'href="/parts/[^"]*/edit"' | wc -l | tr -d ' ')"
H=$(body $B/parts/new)
ck "GET /parts/new 200" "200" "$(code $B/parts/new)"
ck "parts create no required" "0" "$(echo "$H" | grep -c 'required')"
R=$(body -X POST $B/parts -d "name=&sku=&price=")
ck "POST empty -> 400" "400" "$(code -X POST $B/parts -d 'name=&price=')"
ck "name error" "1" "$(echo "$R" | grep -c "Вкажіть назву запчастини")"
ck "price error" "1" "$(echo "$R" | grep -c "Вкажіть ціну (число)")"
R=$(body -X POST $B/parts -d "name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%20%D0%B7%D0%B0%D0%BF.&price=-1")
ck "neg price -> 400" "400" "$(code -X POST $B/parts -d 'name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%20%D0%B7%D0%B0%D0%BF.&price=-1')"
ck "neg price msg" "1" "$(echo "$R" | grep -c "Ціна має бути більшою за 0")"
ck "zero price -> 400" "400" "$(code -X POST $B/parts -d 'name=%D0%A2%D0%B5%D1%81%D1%82&price=0')"
ck "part price 3 decimals -> 400" "400" "$(code -X POST $B/parts -d 'name=%D0%A2%D0%B5%D1%81%D1%82&price=10.999')"
ck "bad sku -> 400" "400" "$(code -X POST $B/parts -d 'name=%D0%A2%D0%B5%D1%81%D1%82&sku=-bad&price=100')"
R=$(body -X POST $B/parts -d "name=%D0%A2%D0%B5%D1%81%D1%82&sku=-bad&price=100")
ck "bad sku msg" "1" "$(echo "$R" | grep -c "SKU: 2–50 символів")"
LOC=$(postloc $B/parts "name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%20%D0%B7%D0%B0%D0%BF%D1%87%D0%B0%D1%81%D1%82%D0%B8%D0%BD%D0%B0%20L3&sku=L3-PART-001&price=1234.56")
ck "POST valid -> 302" "302" "$(echo $LOC | cut -d' ' -f1)"
body $B/parts | grep -q "Тестова запчастина L3" && HAS=1 || HAS=0
ck "parts list shows new" "1" "$HAS"
R=$(body -X POST $B/parts -d "name=%D0%94%D1%83%D0%B1%D0%BB%D1%8C%20SKU&sku=L3-PART-001&price=100")
ck "dup sku -> 400" "400" "$(code -X POST $B/parts -d 'name=%D0%94%D1%83%D0%B1%D0%BB%D1%8C%20SKU&sku=L3-PART-001&price=100')"
ck "dup sku msg" "1" "$(echo "$R" | grep -c "SKU вже використовується")"
NEWP=$(curl -s $B/parts | tr -d '\n' | grep -oE 'Тестова запчастина L3</td>.{0,500}' | grep -oE '/parts/[a-z0-9]+/edit' | head -1 | sed 's|/parts/||;s|/edit||')
echo "   part id: $NEWP"
PED=$(body $B/parts/$NEWP/edit)
ck "GET part edit 200" "200" "$(code $B/parts/$NEWP/edit)"
ck "part edit prefilled sku" "1" "$(echo "$PED" | grep -c 'value="L3-PART-001"')"
LOC=$(curl -s -o /dev/null -w "%{http_code}" -X POST $B/parts/$NEWP/edit -d "name=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%B0%20%D0%B7%D0%B0%D0%BF%D1%87%D0%B0%D1%81%D1%82%D0%B8%D0%BD%D0%B0%20L3%20%28v2%29&sku=L3-PART-002&price=1300")
ck "POST part edit -> 302" "302" "$LOC"
body $B/parts | grep -q "L3-PART-002" && HAS=1 || HAS=0
ck "part edit saved" "1" "$HAS"

echo "== REQUESTS (regression) =="
H=$(body $B/requests/new)
ck "GET /requests/new 200" "200" "$(code $B/requests/new)"
ck "requests create no required" "0" "$(echo "$H" | grep -c 'required')"
R=$(body -X POST $B/requests -d "type=&priority=NORMAL&description=&clientMode=existing&clientId=&deviceMode=existing&deviceId=")
ck "POST empty -> 400" "400" "$(code -X POST $B/requests -d 'type=&description=&clientMode=existing&clientId=&deviceMode=existing&deviceId=')"
ck "req type error" "1" "$(echo "$R" | grep -c "Оберіть тип заявки")"
ck "req desc error" "1" "$(echo "$R" | grep -c "Вкажіть опис проблеми")"
NEWD_ID=$(echo $NEWD | sed 's#.*/##')
ck "short desc -> 400" "400" "$(code -X POST $B/requests -d "type=REPAIR&priority=NORMAL&description=%D0%B0%D0%B1%D0%B2&clientMode=existing&clientId=$OID&deviceMode=existing&deviceId=$NEWD_ID")"
RID=$(curl -s $B/requests | grep -o 'href="/requests/[^/"]*"' | grep -v edit | grep -v new | head -1 | grep -o '/requests/[^/"]*' | sed 's|/requests/||')
H=$(body $B/requests/$RID/edit)
ck "GET /requests/:id/edit 200" "200" "$(code $B/requests/$RID/edit)"
ck "requests edit no required" "0" "$(echo "$H" | grep -c 'required')"

WID=$(curl -s $B/works | grep -o '/works/[a-z0-9]*/edit' | head -1 | sed 's|/works/||;s|/edit||')
PID=$(curl -s $B/parts | grep -o '/parts/[a-z0-9]*/edit' | head -1 | sed 's|/parts/||;s|/edit||')
R=$(postloc $B/requests "type=REPAIR&priority=NORMAL&description=e2e%20req&clientMode=existing&clientId=$OID&deviceMode=existing&deviceId=$NEWD_ID")
ck "req create (valid pair) -> 302" "302" "$(echo $R | cut -d' ' -f1)"
RNEW=$(echo $R | awk '{print $2}')
ck "new req card 200" "200" "$(code $B$RNEW)"
R=$(postloc $B$RNEW/edit "type=MAINTENANCE&priority=NORMAL&description=e2e%20upd&clientId=$OID&deviceId=$NEWD_ID")
ck "req edit (type) -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "Обслуговування" && HAS=1 || HAS=0
ck "req card shows new type" "1" "$HAS"
FDEV=$(curl -s $B/devices | grep -o 'href="/devices/[a-z0-9]*"' | grep -v '"/devices/new"' | grep -v "/devices/$NEWD_ID\"" | head -1 | sed 's|href="/devices/||;s|"$||')
R=$(body -X POST $B/requests -d "type=REPAIR&priority=NORMAL&description=e2e%20req&clientMode=existing&clientId=$OID&deviceMode=existing&deviceId=$FDEV")
ck "create req (foreign device) -> 400" "400" "$(code -X POST $B/requests -d "type=REPAIR&priority=NORMAL&description=e2e%20req&clientMode=existing&clientId=$OID&deviceMode=existing&deviceId=$FDEV")"
ck "foreign device msg" "1" "$(echo "$R" | grep -c "Пристрій не належить обраному клієнту")"
R=$(postloc $B$RNEW/works "workId=$WID&cost=500&hours=2")
ck "add work -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "/works/[a-z0-9]*/delete" && HAS=1 || HAS=0
ck "work row on card" "1" "$HAS"
R=$(postloc $B$RNEW/parts "partId=$PID&quantity=2&unitPrice=100")
ck "add part -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "/parts/[a-z0-9]*/delete" && HAS=1 || HAS=0
ck "part row on card" "1" "$HAS"
PLINE=$(body $B$RNEW | grep -o "parts/[a-z0-9]*/delete" | head -1 | sed 's|parts/||;s|/delete||')
R=$(postloc $B$RNEW/parts/$PLINE/delete "")
ck "remove part -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "/parts/[a-z0-9]*/delete" && HAS=1 || HAS=0
ck "part row gone" "0" "$HAS"

echo "== REQUEST SECTIONS (L3.8b) =="
# $RNEW: 1 робота (500 ₴), без запчастин. Станова машина: NEW.
TECH=$(body $B$RNEW | tr -d '\n' | grep -oE '<select name="technicianId">.{0,300}' | grep -oE 'value="[a-z0-9]+"' | head -1 | sed 's/value="//;s/"//')
ck "have technician for form" "1" "$([ -n "$TECH" ] && echo 1 || echo 0)"
R=$(body -X POST $B$RNEW/diagnostics -d "technicianId=&date=&cost=&findings=&notes=")
ck "diag empty -> 400" "400" "$(code -X POST $B$RNEW/diagnostics -d 'technicianId=&date=&cost=&findings=&notes=')"
ck "diag findings msg" "1" "$(echo "$R" | grep -c "Висновки: мінімум 2 символи")"
ck "diag bad cost -> 400" "400" "$(code -X POST $B$RNEW/diagnostics -d "technicianId=$TECH&cost=-5&findings=тест")"
R=$(postloc $B$RNEW/diagnostics "technicianId=$TECH&date=2026-10-01&cost=150&findings=E2E%20діагностика&notes=тест")
ck "diag valid -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "E2E" && HAS=1 || HAS=0
ck "card shows findings" "1" "$HAS"
R=$(postloc $B$RNEW/estimate "")
ck "estimate create -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "500" && HAS=1 || HAS=0
ck "estimate total on card" "1" "$HAS"
R=$(postloc $B$RNEW/estimate/approve "")
ck "approve estimate -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "Затверджена" && HAS=1 || HAS=0
ck "estimate approved on card" "1" "$HAS"
R=$(body -X POST $B$RNEW/estimate/approve)
ck "double approve -> 400" "400" "$(code -X POST $B$RNEW/estimate/approve)"
ck "double approve msg" "1" "$(echo "$R" | grep -c "вже затверджено")"
R=$(postloc $B$RNEW/invoice "discount=100&dueDate=2026-11-01")
ck "invoice issue -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "400" && HAS=1 || HAS=0
ck "invoice remaining on card" "1" "$HAS"
R=$(body -X POST $B$RNEW/invoice "discount=0")
ck "double invoice -> 400" "400" "$(code -X POST $B$RNEW/invoice -d 'discount=0')"
ck "double invoice msg" "1" "$(echo "$R" | grep -c "Рахунок вже видано")"
ck "overpay -> 400" "400" "$(code -X POST $B$RNEW/payments -d 'amount=99999&method=CASH&note=')"
R=$(postloc $B$RNEW/payments "amount=300&method=CASH&note=e2e")
ck "payment 300 -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "Частково сплачено" && HAS=1 || HAS=0
ck "invoice partial" "1" "$HAS"
R=$(postloc $B$RNEW/payments "amount=100&method=CARD")
ck "payment 100 -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "Сплачено" && HAS=1 || HAS=0
ck "invoice paid" "1" "$HAS"
R=$(postloc $B$RNEW/warranty "periodDays=90&startDate=&scope=e2e%20%D0%B3%D0%B0%D1%80%D0%B0%D0%BD%D1%82%D1%94%D1%8F")
ck "warranty -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "90 днів" && HAS=1 || HAS=0
ck "warranty on card" "1" "$HAS"
ck "warranty bad period -> 400" "400" "$(code -X POST $B$RNEW/warranty -d 'periodDays=42&startDate=&scope=x')"
WRID=$(body "$B/requests?type=WARRANTY_CLAIM" | grep -oE 'href="/requests/[a-z0-9]+"' | grep -v '/new' | head -1 | sed 's|href="/requests/||;s|"||')
ck "seeded warranty claim found" "1" "$(echo "$WRID" | grep -c .)"
ck "warranty ref inside card" "1" "$(body $B/requests/$WRID | tr -d '\n' | grep -oE 'Гарантійне посилання</h2>.*' | sed 's|</section>.*||' | grep -c 'Оригінальний ремонт')"
ck "comment short -> 400" "400" "$(code -X POST $B$RNEW/comments -d 'text=x')"
R=$(postloc $B$RNEW/comments "text=e2e%20%D0%BA%D0%BE%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%80&isInternal=on")
ck "comment -> 302" "302" "$(echo $R | cut -d' ' -f1)"
body $B$RNEW | grep -q "e2e коментар" && HAS=1 || HAS=0
ck "comment on card" "1" "$HAS"
ck "upload no file -> 400" "400" "$(code -X POST $B$RNEW/attachments -F 'dummy=x')"
TF="e2e-attach-$$.txt"; printf 'e2e attach\n' > "$TF"
ck "upload -> 302" "302" "$(code -X POST $B$RNEW/attachments -F "file=@$TF")"
body $B$RNEW | grep -q "$TF" && HAS=1 || HAS=0
ck "attachment on card" "1" "$HAS"
FL=$(body $B$RNEW | tr -d '\n' | grep -oE 'href="/uploads/[^"]+"' | head -1 | sed 's|href="||;s|"||')
rm -f "$TF"
ck "uploaded file served" "200" "$(code $B$FL)"

echo "== DELETE (L3.8) =="
body $B/works | grep -q '/works/[a-z0-9]*/delete' && HAS=1 || HAS=0
ck "works list has delete" "1" "$HAS"
body $B/clients | grep -q '/clients/[a-z0-9]*/delete' && HAS=1 || HAS=0
ck "clients list has delete" "1" "$HAS"
body $B/devices | grep -q '/devices/[a-z0-9]*/delete' && HAS=1 || HAS=0
ck "devices list has delete" "1" "$HAS"
body $NEWC/edit | grep -q "/clients/.*delete" && HAS=1 || HAS=0
ck "clients edit has delete" "1" "$HAS"
body $NEWD/edit | grep -q "/devices/.*delete" && HAS=1 || HAS=0
ck "devices edit has delete" "1" "$HAS"
body $B/works/$NEWW/edit | grep -q "/works/.*delete" && HAS=1 || HAS=0
ck "works edit has delete" "1" "$HAS"
body $B/parts/$NEWP/edit | grep -q "/parts/$NEWP/delete" && HAS=1 || HAS=0
ck "parts edit has delete" "1" "$HAS"
H=$(body $NEWC/delete)
ck "client delete confirm page 200" "200" "$(code $NEWC/delete)"
ck "confirm page: server form, не confirm()" "1" "$(echo "$H" | grep -c 'Так, видалити')"
ck "confirm page: no browser confirm()" "0" "$(echo "$H" | grep -c 'confirm(')"
ck "confirm page: cancel link" "1" "$(echo "$H" | grep -c 'Скасувати')"
ck "device delete confirm page 200" "200" "$(code $NEWD/delete)"
ck "work delete confirm page 200" "200" "$(code $B/works/$NEWW/delete)"
ck "part delete confirm page 200" "200" "$(code $B/parts/$NEWP/delete)"
ck "confirm page 404 for unknown id" "404" "$(code $B/clients/no-such-id/delete)"
R=$(postloc $NEWC/delete "")
ck "client delete -> 302 /clients" "302 /clients" "$R"
ck "deleted client card 404" "404" "$(code $NEWC)"
ck "deleted client edit 404" "404" "$(code $NEWC/edit)"
R=$(postloc $NEWD/delete "")
ck "device delete -> 302 /devices" "302 /devices" "$R"
ck "deleted device card 404" "404" "$(code $NEWD)"
ck "deleted device edit 404" "404" "$(code $NEWD/edit)"
R=$(postloc $B/works/$NEWW/delete "")
ck "work delete -> 302 /works" "302 /works" "$R"
body $B/works | grep -q "Заміна термопастою L3" && HAS=1 || HAS=0
ck "work gone from list" "0" "$HAS"
ck "deleted work edit 404" "404" "$(code $B/works/$NEWW/edit)"
FIRSTP=$(curl -s $B/parts | grep -o '/parts/[a-z0-9]*/edit' | head -1 | sed 's|/parts/||;s|/edit||')
R=$(body -X POST $B/parts/$FIRSTP/delete)
ck "in-use part delete -> 400" "400" "$(code -X POST $B/parts/$FIRSTP/delete)"
ck "in-use part msg" "1" "$(echo "$R" | grep -c "не можна видалити, бо вона використовується")"
R=$(postloc $B/parts/$NEWP/delete "")
ck "free part delete -> 302 /parts" "302 /parts" "$R"
body $B/parts | grep -q "Тестова запчастина L3 (v2)" && HAS=1 || HAS=0
ck "part gone from list" "0" "$HAS"
ck "deleted part edit 404" "404" "$(code $B/parts/$NEWP/edit)"

H=$(body $B$RNEW/delete)
ck "request delete confirm 200" "200" "$(code $B$RNEW/delete)"
ck "request confirm: Так, видалити" "1" "$(echo "$H" | grep -c 'Так, видалити')"
R=$(postloc $B$RNEW/delete "")
ck "request delete -> 302 /requests" "302 /requests" "$R"
ck "deleted request card 404" "404" "$(code $B$RNEW)"

echo "== GLOBAL: no 'required' in any form page =="
for u in /clients/new /devices/new /works/new /parts/new /requests/new; do
  C=$(body $B$u | grep -c 'required')
  ck "no required on $u" "0" "$C"
done

echo ""
echo "RESULT: pass=$P fail=$F"