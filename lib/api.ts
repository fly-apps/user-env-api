const UPSTREAM_ORIGIN = "https://api.machines.dev";

function rewriteUpstreamUrl(req: Request): string {
  const url = new URL(req.url);
  url.hostname = "api.machines.dev";
  url.protocol = "https";
  url.port = "";
  return url.toString();
}

function filterHeaders(headers: Headers): Headers {
  const newHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() !== "accept-encoding" && key.toLowerCase() !== "connection") {
      newHeaders.set(key, value);
    }
  }
  newHeaders.set("host", "api.machines.dev");
  newHeaders.set("accept-encoding", "identity");
  return newHeaders;
}

export const api = {
  proxy: async (req: Request): Promise<Response> => {
    const upstreamUrl = rewriteUpstreamUrl(req);
    const headers = filterHeaders(req.headers);
    console.log(`[proxy] Proxying request to: ${upstreamUrl}`);
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: req.body,
    });
    return new Response(response.body, response);
  },
  async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `https://api.machines.dev${path}`;
    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept-Encoding")) {
      headers.set("Accept-Encoding", "identity");
    }
    return fetch(url, { ...options, headers });
  }
}; 