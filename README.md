# Online Shopping Microservices

Three small Node.js services: a browser storefront, product catalog API, and order API. The frontend proxies API requests so the browser only needs to reach port 3000.

## Run locally with Docker Compose

```sh
docker compose up --build
```

Open <http://localhost:3000>. The APIs are also available directly at `http://localhost:3001` (products) and `http://localhost:3002` (orders). Stop the stack with `docker compose down`.

Each service exposes `/health` and `/metrics`. Prometheus metrics include request totals, error totals, request duration, and the default Node.js process metrics, including CPU and memory. Orders are held in memory and are cleared when the order service restarts; use persistent storage before deploying beyond a demo.