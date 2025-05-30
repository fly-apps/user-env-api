import { readFileSync } from "fs";
import { join } from "path";
import { api } from "./api";
import { listSecrets } from "./secrets";

interface MachineConfig {
  image: string;
  env?: Record<string, string>;
  restart?: {
    policy: string;
  };
  mounts?: Array<{
    volume: any;
    path: string;
  }>;
  [key: string]: any;
}

interface ProcessedConfig {
  mounts: any[];
  containers: any[];
  volumes: any[];
  [key: string]: any;
}

interface Secret {
  name: string;
  value: string;
}

export async function processConfig(config: MachineConfig, secrets: Secret[]): Promise<ProcessedConfig> {
  // Read the template
  const templatePath = join(process.cwd(), "templates", "machine-container-config.json");
  const template = JSON.parse(readFileSync(templatePath, "utf-8"));

  // Process mounts - modify user's mounts to use /dev/fly_vol
  const mounts = config.mounts?.map(mount => ({
    ...mount,
    path: "/dev/fly_vol"
  })) || [];

  // Transform secrets into container config format, excluding Tigris secrets
  const containerSecrets = secrets
    .filter(secret => !secret.name.startsWith("FLY_TIGRIS_"))
    .map(secret => ({
      name: secret.name,
      env_var: secret.name
    }));

  // Process containers
  const containers = template.containers.map((container: any) => {
    if (container.name === "app") {
      return {
        ...container,
        env: {
          ...config.env,
          FLY_USER_DATA_PATH: config.mounts?.[0]?.path || "/data"
        },
        secrets: containerSecrets,
        files: [{
          guest_path: "/etc/app-image.json",
          image_config: config.image
        }],
        restart: {
          policy: config.restart?.policy
        }
      };
    }
    return container;
  });

  // Process volumes
  const volumes = template.volumes.map((volume: any) => {
    if (volume.name === "app-image") {
      return {
        ...volume,
        image: config.image
      };
    }
    return volume;
  });

  // Merge with user's config, preserving user values
  return {
    ...config,
    mounts,
    containers,
    volumes
  };
}

export async function create(req: Request, appName: string): Promise<Response> {
  const body = await req.json();

  // Fetch secrets for the app
  const secretsResponse = await listSecrets(appName, req.headers.get("Authorization") || "");
  const secretsJson = await secretsResponse.json();
  const secrets = secretsJson.secrets || [];

  // Process the config with the secrets
  const processedConfig = await processConfig(body.config, secrets);
  console.log('[MACHINE CONFIG]', JSON.stringify(processedConfig, null, 2));

  // Create the machine
  return api.fetch(`/v1/apps/${appName}/machines`, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ ...body, config: processedConfig })
  });
} 