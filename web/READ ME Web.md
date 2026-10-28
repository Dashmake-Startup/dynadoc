## 🚀 Getting Started

### Prerequisites

* **Node.js**: v20+
* **Package Manager**: npm

### Installation

```bash
npm install

```

## 🛠 Development

### Running the Web Frontend

To run the local development server:

```bash
npm run dev:web

```

### API Configuration

The platform communicates with a backend API. You can toggle between production and local environments by setting the `VITE_API_URL` environment variable:

* **Default (Production):** `https://api.dynadoc.dashmake.com`
* **Local Backend:**
```bash
VITE_API_URL=http://localhost:7070 npm run dev:web

```



---

## 🌐 Deployment (Web Production)

This application is a static site (SPA) that can be served by any web server (Nginx, Apache, or Node-based static servers).

### 1. Build the Application

Compile the source code into the production-ready `dist` folder:

```bash
npm run build:web

```

### 2. Deploy to a Server

We recommend using a process manager like **PM2** to keep the static server alive, or a dedicated web server like **Nginx** for better performance.

#### Method A: Simple Deployment (for testing)

If you just need to host it quickly, use the `serve` package:

```bash
# Install globally
npm install -g serve

# Serve the build folder
serve web/dist -l 3000

```

#### Method B: Professional Deployment (Recommended)

For production, use **Nginx**. This avoids the overhead of running a Node.js process just to serve static files.

1. **Install Nginx** on your server.
2. **Upload** your `web/dist` folder content to `/var/www/dynadoc`.
3. **Configure Nginx** (`/etc/nginx/sites-available/dynadoc`):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/dynadoc;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

```


4. **Restart Nginx**: `sudo systemctl restart nginx`

---

## 🏗 Project Architecture & Troubleshooting

### Build Memory Limits

If your build fails with an "Ineffective mark-compacts near heap limit" error, increase the memory allocated to Node:

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run build:web

```

### Circular Dependency Check

We maintain a clean dependency graph to ensure stability. Before committing, verify your project structure:

```bash
node scripts/check-cycles.mjs

```

---

### Would you like me to create a `Dockerfile` for this project so you can deploy it as a containerized app instead?