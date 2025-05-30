# Fly User Environment API Proxy

This API proxy service enables end users to provision Fly machines with Tigris-backed state storage. It uses `github.com/superfly/app-storage` for setting up the environment for Fly applications.

## Overview

The API proxy service provides a secure way to create and manage Fly applications with Tigris storage integration. It enforces organization restrictions to ensure applications are created in the correct organization.

## Organization Restrictions

The service enforces organization restrictions in the following ways:

1. **Environment Variable Control**: Set `FLY_ALLOWED_ORGS` to control which organizations can create apps:
   - Comma-separated list of org slugs (e.g., `org1,org2`)
   - Use `*` to allow all organizations
   - Leave unset to restrict to the current app's organization

2. **Current App Organization**: When `FLY_ALLOWED_ORGS` is not set, the service will:
   - Look up the organization of the current app (set via `FLY_APP_NAME`)
   - Only allow app creation in that same organization

3. **Request Validation**: All app creation requests must include:
   - `org_slug`: The target organization for the new app
   - The request will be rejected if the organization is not allowed

## Setup

1. Deploy the API proxy to Fly.io:
   ```bash
   fly launch --from https://github.com/fly-apps/user-env-api --yes
   ```

2. Run `fly tigris dashboard` and:
   - Create new credentials with Admin privileges
   - Set the following secrets on your Fly app:
     ```bash
     fly secrets set FLY_TIGRIS_ACCESS_KEY_ID="your-access-key"
     fly secrets set FLY_TIGRIS_SECRET_ACCESS_KEY="your-secret-key"
     fly secrets set FLY_TIGRIS_BUCKET="my-user-env-api-bucket"
     ```

## Usage

The API proxy provides the following endpoints:

- `POST /v1/apps` - Create a new app with Tigris-backed state storage
- `DELETE /v1/apps/:app_name` - Delete an app and its state
- `POST /v1/apps/:app_name/machines` - Create a machine for an app
- All other `/v1/*` endpoints are proxied to the Fly API

### Create an App

```bash
curl -X POST http://my-user-env-api.fly.dev/v1/apps \
  -H "Authorization: Bearer your-fly-token" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "my-app",
    "org_slug": "my-org"
  }'
```

### List App Secrets

```bash
curl http://my-user-env-api.fly.dev/v1/apps/my-app/secrets \
  -H "Authorization: Bearer your-fly-token"
```

### Create a Machine

```bash
curl -X POST http://my-user-env-api.fly.dev/v1/apps/my-app/machines \
  -H "Authorization: Bearer your-fly-token" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "image": "flyio/ubuntu:latest",
      "mounts": [
        {
          "volume": "vol_123",
          "path": "/data"
        }
      ]
    }
  }'
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.