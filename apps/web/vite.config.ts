import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

// The browser only ever talks to apps/api; /api/* is proxied to it. The api
// port comes from the root .env so the two stay in sync.
function apiPort(): number {
  try {
    const env = fs.readFileSync(path.resolve(__dirname, "../../.env"), "utf8");
    const m = env.match(/^PORT=(\d+)/m);
    if (m) return Number(m[1]);
  } catch {
    // no .env yet
  }
  return 3000;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort()}`,
        configure: (proxy) => {
          // Answer with JSON when the api is down instead of letting the
          // request fall through to the SPA shell.
          proxy.on("error", (err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "content-type": "application/json" });
              res.end(JSON.stringify({ error: `api unreachable on port ${apiPort()}: ${err.message}. Is pnpm dev running the api?` }));
            }
          });
        },
      },
    },
  },
});
