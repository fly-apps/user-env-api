import { api } from "./api";

interface OrgConfig {
  allowedOrgs: string[];
  isWildcard: boolean;
}

let cachedOrg = "";
let orgConfig: OrgConfig | null = null;

function parseAllowedOrgs(): OrgConfig {
  const allowedOrgs = process.env.FLY_ALLOWED_ORGS;
  if (!allowedOrgs) {
    return { allowedOrgs: [], isWildcard: false };
  }

  if (allowedOrgs === "*") {
    return { allowedOrgs: [], isWildcard: true };
  }

  return {
    allowedOrgs: allowedOrgs.split(",").map(org => org.trim()),
    isWildcard: false
  };
}

async function getCurrentOrg(token: string): Promise<string> {
  if (cachedOrg) {
    return cachedOrg;
  }

  const appName = process.env.FLY_APP_NAME;
  if (!appName) {
    throw new Error("FLY_APP_NAME not set");
  }

  console.log(`[orgs] Looking up org for app: ${appName}`);
  const response = await api.fetch(`/v1/apps/${appName}`, {
    headers: { "Authorization": token }
  });

  if (!response.ok) {
    throw new Error("Failed to get current app info");
  }

  const data = await response.json();
  cachedOrg = data.organization.slug;
  console.log(`[orgs] Looked up org: ${cachedOrg}`);
  return cachedOrg;
}

export async function validateOrg(token: string, org_slug: string): Promise<boolean> {
  // If we're not running in a Fly machine, allow all orgs
  if (!process.env.FLY_APP_NAME) {
    return true;
  }

  // Initialize org config if not already done
  if (!orgConfig) {
    orgConfig = parseAllowedOrgs();
  }

  // If wildcard is enabled, allow all orgs
  if (orgConfig.isWildcard) {
    return true;
  }

  // If we have allowed orgs configured, check against that list
  if (orgConfig.allowedOrgs.length > 0) {
    const allowed = orgConfig.allowedOrgs.includes(org_slug);
    if (!allowed) {
      console.error(`[orgs] Org check failed: requested org_slug=${org_slug}, allowedOrgs=${orgConfig.allowedOrgs.join(",")}`);
    }
    return allowed;
  }

  // Otherwise, check against the current org
  const currentOrg = await getCurrentOrg(token);
  const match = currentOrg === org_slug;
  if (!match) {
    console.error(`[orgs] Org check failed: requested org_slug=${org_slug}, currentOrg=${currentOrg}`);
  }
  return match;
} 