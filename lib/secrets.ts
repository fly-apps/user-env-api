import { api } from "./api.ts";

export async function listSecrets(appName: string, authHeader: string): Promise<Response> {
  const response = await api.fetch(`/v1/apps/${appName}/secrets`, {
    headers: {
      "Authorization": authHeader
    }
  });
  console.log(`[listSecrets] Response for ${appName}:`, await response.clone().json());
  return response;
}

export async function setSecret(appName: string, key: string, value: string, authHeader: string): Promise<Response> {
  return api.fetch(`/v1/apps/${appName}/secrets/${key}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({ value })
  });
}

export async function setSecrets(appName: string, secrets: Record<string, string>, authHeader: string): Promise<Response[]> {
  const promises = Object.entries(secrets).map(([key, value]) => setSecret(appName, key, value, authHeader));
  const responses = await Promise.all(promises);
  const failedResponses = responses.filter(response => !response.ok);
  if (failedResponses.length > 0) {
    console.error(`[setSecrets] Failed responses for ${appName}:`, failedResponses.map(r => r.statusText));
    throw new Error(`Failed to set secrets: ${failedResponses.map(r => r.statusText).join(', ')}`);
  }
  console.log(`[setSecrets] Successfully set secrets for ${appName}`);
  return responses;
} 