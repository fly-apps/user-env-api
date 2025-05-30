/// <reference types="bun-types" />
import * as apps from "./lib/apps";
import { api } from "./lib/api.ts";
import * as machines from "./lib/machines";

export default async function startServer(port: number) {
  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    async fetch(req: Request) {
      const url = new URL(req.url);
      
      // Handle app creation
      if (url.pathname === "/v1/apps" && req.method === "POST") {
        return apps.create(req);
      }

      // Handle app deletion
      if (/^\/v1\/apps\/[^\/]+$/.test(url.pathname) && req.method === "DELETE") {
        return apps.destroy(req);
      }

      // Handle machine creation
      const machineMatch = url.pathname.match(/^\/v1\/apps\/([^\/]+)\/machines$/);
      if (machineMatch && req.method === "POST") {
        return machines.create(req, machineMatch[1]);
      }

      // Proxy all other requests to the upstream API
      return api.proxy(req);
    }
  });

  return {
    stop: () => server.stop()
  };
}

// Start the server if this file is run directly
if (import.meta.main) {
  const port = 8080;
  console.log(`Starting server on port ${port}...`);
  await startServer(port);
  console.log(`Server listening on http://0.0.0.0:${port}`);
} 