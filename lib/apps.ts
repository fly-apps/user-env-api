import { createTigrisBucket, deleteBucket } from "./tigris.ts";
import { api } from "./api.ts";
import { setSecrets } from "./secrets.ts";
import { validateOrg } from "./orgs";

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

export async function create(token: string, name: string, org_slug: string): Promise<Response> {
  // Validate org access
  const isValidOrg = await validateOrg(token, org_slug);
  if (!isValidOrg) {
    return new Response("Unauthorized: Invalid organization", { status: 403 });
  }

  let bucketCreated = false;

  try {
    // First, create the app
    const createResponse = await api.fetch("/v1/apps", {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ app_name: name, org_slug })
    });

    if (!createResponse.ok) {
      return createResponse;
    }

    // Create bucket and credentials
    console.debug(`[create] Creating Tigris bucket and credentials for: ${name}`);
    const credentials = await createTigrisBucket(name);
    bucketCreated = true;

    // Set app secrets
    console.debug(`[create] Setting app secrets for: ${name}`);
    await setSecrets(name, {
      FLY_TIGRIS_ACCESS_KEY_ID: credentials.accessKeyId,
      FLY_TIGRIS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      FLY_TIGRIS_BUCKET: credentials.bucket,
    }, token);

    // Return the original response
    return createResponse;
  } catch (error) {
    // Clean up on failure
    if (bucketCreated) {
      console.debug(`[create] Deleting bucket due to error: ${name}`);
      await deleteBucket(name);
    }
    await deleteApp(name, token);
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