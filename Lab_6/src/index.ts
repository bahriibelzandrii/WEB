import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Lab 2 service: http://localhost:${PORT} (/, /requests, /clients, /devices, /works, /parts, /health)`);
});
