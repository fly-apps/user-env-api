# Fly User Environment API Proxy

This is an API proxy service that enables end users to provision Fly machines with Tigris-backed state storage. It provides a simple way for users to get started with persistent state in their Fly applications, with each app getting its own isolated Tigris bucket.

This project uses [github.com/superfly/app-storage](https://github.com/superfly/app-storage) to set up the environment for Fly applications.

## Setup

1. Deploy the API proxy to Fly.io:
   ```bash
   fly launch --name my-user-env-api
   ```

2. Create a Tigris bucket for state storage:
   ```bash
   fly bucket create my-user-env-api-bucket
   ```

3. Visit the [Tigris Dashboard](https://fly.storage.tigris.dev) and:
   - Create admin credentials
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

## Development

1. Install dependencies:
```bash
bun install
```

2. Run the server locally:
```bash
bun run server.ts
```

The server will start on port 8080 and listen on all interfaces (0.0.0.0).

## License

This project is licensed under the MIT License - see the LICENSE file for details. 