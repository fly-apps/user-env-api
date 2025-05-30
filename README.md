# Fly User Environment API Proxy

This is an API proxy service that enables end users to provision Fly machines with Tigris-backed state storage. It provides a simple way for users to get started with persistent state in their Fly applications, with each app getting its own isolated Tigris bucket.

This project uses [github.com/superfly/app-storage](https://github.com/superfly/app-storage) to set up the environment for Fly applications.

## Setup

1. Deploy the API proxy to Fly.io:
   ```bash
   fly launch --from https://github.com/fly-apps/user-env-api --yes
   ```

2. Create a Tigris bucket for state storage:
   ```bash
   fly bucket create my-user-env-api-bucket
   ```

3. Rrun `fly tigris dashboard` and:
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

### Example: Creating an App

```bash
curl -X POST http://my-user-env-api.fly.dev/v1/apps \
  -H "Authorization: Bearer your-fly-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "org_slug": "your-org"
  }'
```

### Example: Deleting an App

```bash
curl -X DELETE http://my-user-env-api.fly.dev/v1/apps/my-app \
  -H "Authorization: Bearer your-fly-token"
```

### Example: Creating a Machine

```bash
curl -X POST http://my-user-env-api.fly.dev/v1/apps/my-app/machines \
  -H "Authorization: Bearer your-fly-token" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "image": "flyio/ubuntu:latest",
      "mounts": [{ "volume": "your-volume-id", "path": "/data" }]
    }
  }'
```