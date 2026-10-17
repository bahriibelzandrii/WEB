# ER-діаграма

```mermaid
erDiagram
    User ||--o{ Request : "createdBy"
    User ||--o{ Request : "assignedTo"
    User ||--o{ RequestWork : "technician"
    User ||--o{ Diagnostics : "technician"
    User ||--o{ Estimate : "createdBy"
    User ||--o{ Comment : "author"
    User ||--o{ FileAttachment : "uploadedBy"

    Client ||--o{ Device : "owner"
    Client ||--o{ Request : "client"

    Device ||--o{ Request : "device (історія приладу)"

    Request ||--o| Diagnostics : "1-0..1"
    Request ||--o{ RequestWork : "works"
    Request ||--o{ RequestPart : "parts"
    Request ||--o| Estimate : "1-0..1"
    Request ||--o| Invoice : "1-0..1"
    Request ||--o| Warranty : "1-0..1"
    Request ||--o{ Comment : "comments"
    Request ||--o{ FileAttachment : "attachments"
    Request |o--o| Request : "originalRequest (self, warranty claim)"

    WorkCatalog ||--o{ RequestWork : "priced as"
    Part ||--o{ RequestPart : "used in"
    Estimate ||--o| Invoice : "issued as"
    Invoice ||--o{ Payment : "payments"
```

## Легенда ключових зв'язків

- **Request** — центр моделі: клієнт + прилад + тип/статус/пріоритет + грошова
  ланцюжка (Diagnostics/Estimate/Invoice/Payment) + гарантія + комунікація.
- **Device → Request (1—N)** — історія сервісу конкретного приладу.
- **Request → Request (self)** — гарантійне звернення посилається на оригінальний ремонт.
- **WorkCatalog / Part → …Work/…Part (1—N)** — каталог + снапшот ціни в заявці
  (ціна фіксується на момент заявки, зміни прайсу не переписують історію).
- **Estimate → Invoice (1—0..1)** — рахунок видається лише з затвердженої оцінки.
- **Invoice → Payment (1—N)** — часткові оплати.
