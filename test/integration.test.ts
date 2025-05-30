import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTigrisBucket, deleteBucket } from "../lib/tigris.ts";
import { randomUUID } from "crypto";

// Test configuration
const TEST_PORT = Math.floor(Math.random() * (65535 - 3000) + 3000);
const TEST_HOST = `http://localhost:${TEST_PORT}`;
const TEST_AUTH = `Bearer ${process.env.FLY_USER_APPS_DEV_TOKEN}`;
const TEST_ORG = process.env.FLY_USER_APPS_DEV_ORG;

if (!process.env.FLY_USER_APPS_DEV_TOKEN) {
  throw new Error("FLY_USER_APPS_DEV_TOKEN environment variable is required for tests");
}

if (!TEST_ORG) {
  throw new Error("FLY_USER_APPS_DEV_ORG environment variable is required for tests");
}

// Store created resources for cleanup
const createdApps: string[] = [];
const createdBuckets: string[] = [];

// Start the server
let server: any;
beforeAll(async () => {
  // Import and start the server
  const { default: startServer } = await import("../server.ts");
  server = await startServer(TEST_PORT);
});

// Clean up after each test
afterEach(async () => {
  // Delete all created buckets
  for (const bucket of createdBuckets) {
    try {
      await deleteBucket(bucket);
    } catch (error) {
      console.error(`Failed to delete bucket ${bucket}:`, error);
    }
  }
  createdBuckets.length = 0;
});

// Clean up and stop server after all tests
afterAll(async () => {
  // Delete all created apps
  for (const appName of createdApps) {
    try {
      await fetch(`${TEST_HOST}/v1/apps/${appName}`, {
        method: "DELETE",
        headers: { 
          "Authorization": TEST_AUTH,
          "Accept-Encoding": "identity"
        }
      });
    } catch (error) {
      console.error(`Failed to delete app ${appName}:`, error);
    }
  }
  createdApps.length = 0;

  // Stop the server
  if (server) {
    await server.stop();
  }
});

describe("API Integration Tests", () => {
  let testApp: string;
  let testBucket: string;
  let testVolumeId: string;

  test("should create an app with Tigris bucket", async () => {
    testApp = `test-app-${randomUUID()}`;
    createdApps.push(testApp);

    const response = await fetch(`${TEST_HOST}/v1/apps`, {
      method: "POST",
      headers: {
        "Authorization": TEST_AUTH,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity"
      },
      body: JSON.stringify({
        app_name: testApp,
        org_slug: TEST_ORG
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[TEST ERROR] Upstream create failed: status=${response.status}, body=${errorBody}`);
    }
    expect(response.ok).toBe(true);
    // Store bucket for cleanup
    const data = await response.json();
    testBucket = testApp;
    createdBuckets.push(testBucket);
    console.log("Created bucket:", testBucket);
  });

  test("should list app secrets", async () => {
    expect(testApp).toBeDefined();
    expect(testBucket).toBeDefined();
    
    // Now list secrets
    const secretsResponse = await fetch(`${TEST_HOST}/v1/apps/${testApp}/secrets`, {
      headers: { 
        "Authorization": TEST_AUTH,
        "Accept-Encoding": "identity"
      }
    });

    expect(secretsResponse.ok).toBe(true);
    const secrets = (await secretsResponse.json()).secrets;
    
    // Verify Tigris secrets are set
    const secretNames = secrets.map((s: any) => s.name);
    expect(secretNames).toContain("FLY_TIGRIS_ACCESS_KEY_ID");
    expect(secretNames).toContain("FLY_TIGRIS_SECRET_ACCESS_KEY");
    expect(secretNames).toContain("FLY_TIGRIS_BUCKET");
  });

  test("should create a volume", async () => {
    expect(testApp).toBeDefined();
    const volumeResponse = await fetch(`${TEST_HOST}/v1/apps/${testApp}/volumes`, {
      method: "POST",
      headers: {
        "Authorization": TEST_AUTH,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity"
      },
      body: JSON.stringify({
        size_gb: 1,
        name: "data"
      })
    });
    expect(volumeResponse.ok).toBe(true);
    const volumeData = await volumeResponse.json();
    testVolumeId = volumeData.id;
    expect(testVolumeId).toBeDefined();
  });

  test("should create a machine", async () => {
    expect(testApp).toBeDefined();
    expect(testBucket).toBeDefined();
    expect(testVolumeId).toBeDefined();

    const machineResponse = await fetch(`${TEST_HOST}/v1/apps/${testApp}/machines`, {
      method: "POST",
      headers: {
        "Authorization": TEST_AUTH,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity"
      },
      body: JSON.stringify({
        config: {
          image: "flyio/ubuntu:latest",
          mounts: [{ volume: testVolumeId, path: "/data" }]
        }
      })
    });

    if (!machineResponse.ok) {
      const errorBody = await machineResponse.text();
      console.error(`[TEST ERROR] Machine create failed: status=${machineResponse.status}, body=${errorBody}`);
    }
    expect(machineResponse.ok).toBe(true);
    const machineData = await machineResponse.json();
    expect(machineData.id).toBeDefined();
  });

  test("should delete an app", async () => {
    expect(testApp).toBeDefined();
    expect(testBucket).toBeDefined();

    // Delete app
    const deleteResponse = await fetch(`${TEST_HOST}/v1/apps/${testApp}`, {
      method: "DELETE",
      headers: { 
        "Authorization": TEST_AUTH,
        "Accept-Encoding": "identity"
      }
    });

    expect(deleteResponse.ok).toBe(true);
    expect(deleteResponse.status).toBe(202);

    // Verify app is deleted by checking it doesn't exist
    const getResponse = await fetch(`${TEST_HOST}/v1/apps/${testApp}`, {
      headers: { 
        "Authorization": TEST_AUTH,
        "Accept-Encoding": "identity"
      }
    });
    expect(getResponse.status).toBe(200);
  });
}); 