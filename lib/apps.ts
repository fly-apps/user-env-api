import { createTigrisBucket, deleteBucket } from "./tigris.ts";
import { api } from "./api.ts";
import { setSecrets } from "./secrets.ts";

interface CreateAppResponse {
  id: string;
  name: string;
  organization: string;
  status: string;
  bucket?: string;
}

interface SuccessResponse {
  success: boolean;
}

interface ErrorResponse {
  error: string;
  status: string;
}

const MACHINES_API_BASE_URL = "https://api.machines.dev/v1";

async function deleteApp(appName: string, authHeader: string): Promise<void> {
  try {
    console.debug(`[deleteApp] Deleting app: ${appName}`);
    await api.fetch(`/apps/${appName}`, {
      method: "DELETE",
      headers: {
        "Authorization": authHeader
      }
    });
  } catch (error) {
    console.error(`Failed to delete app ${appName}:`, error);
  }
}

export async function create(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  let bucketCreated = false;

  // Clone the request body so we can parse it and also proxy it
  const reqBody = await req.clone().json();
  const appName = reqBody.app_name;
  if (!appName || typeof appName !== "string") {
    return new Response(JSON.stringify({ error: "app_name is required in request body", status: "error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // First, create the app upstream
  console.debug(`[create] Creating app upstream`);
  const createResponse = await api.proxy(req);

  // If upstream creation fails, return the error response
  if (!createResponse.ok) {
    console.debug(`[create] Upstream app creation failed with status: ${createResponse.status}`);
    return createResponse;
  }

  try {
    // Create bucket and credentials
    console.debug(`[create] Creating Tigris bucket and credentials for: ${appName}`);
    const credentials = await createTigrisBucket(appName);
    bucketCreated = true;

    // Set app secrets
    console.debug(`[create] Setting app secrets for: ${appName}`);
    await setSecrets(appName, {
      FLY_TIGRIS_ACCESS_KEY_ID: credentials.accessKeyId,
      FLY_TIGRIS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      FLY_TIGRIS_BUCKET: credentials.bucket,
    }, authHeader);

    // Return the original response as-is
    return createResponse;
  } catch (error) {
    if (bucketCreated) {
      console.debug(`[create] Deleting bucket due to error: ${appName}`);
      await deleteBucket(appName);
    }
    await deleteApp(appName, authHeader);
    return new Response(JSON.stringify({ error: `Failed to set up Tigris: ${error.message}`, status: "error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function destroy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const appName = parts[parts.length - 1];
  const authHeader = req.headers.get("Authorization") || "";
  if (!appName) {
    return new Response(JSON.stringify({ error: "Missing app name in URL", status: "error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  let bucketDeleted = false;
  try {
    // Try to delete the Tigris bucket first
    await deleteBucket(appName);
    bucketDeleted = true;
  } catch (err) {
    console.error(`[deleteAppHandler] Failed to delete Tigris bucket for ${appName}:`, err);
    // Continue to try deleting the app even if bucket deletion fails
  }
  try {
    await deleteApp(appName, authHeader);
    return new Response(JSON.stringify({ success: true, bucketDeleted }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Failed to delete app: ${err.message}`, status: "error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 