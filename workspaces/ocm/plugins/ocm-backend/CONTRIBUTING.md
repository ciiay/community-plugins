# Setting up the development environment for OCM backend plugin

## Isolated backend dev server

From the OCM workspace:

```console
cd workspaces/ocm/plugins/ocm-backend
LEGACY_BACKEND_START=true yarn start
```

Or from the workspace root:

```console
LEGACY_BACKEND_START=true yarn workspace @backstage-community/plugin-ocm-backend run start
```

The backend listens on **http://localhost:7007** and loads config from `workspaces/ocm/app-config.yaml` and `workspaces/ocm/app-config.local.yaml`.

### What the dev entry provides

The file `plugins/ocm-backend/dev/index.ts`:

- Starts **MSW** using handlers from `__fixtures__/handlers.ts`, intercepting Kubernetes API requests to `https://example.com`.
- Loads **guest auth** (`@backstage/plugin-auth-backend` and `@backstage/plugin-auth-backend-module-guest-provider`) so the frontend dev app can authenticate API calls.
- Registers the **catalog** and **OCM** backend plugins.

### Mock cluster data

MSW provides three managed clusters:

| OCM name          | Backstage catalog name | Notes                                           |
| ----------------- | ---------------------- | ----------------------------------------------- |
| `local-cluster`   | `foo`                  | Hub cluster (name from `app-config.local.yaml`) |
| `cluster1`        | `cluster1`             | Available cluster                               |
| `offline-cluster` | `offline-cluster`      | Offline cluster                                 |

A 404 response is mocked for non-existent clusters.

### Verify the backend

With the server running, fetch cluster status (requires a guest token from the frontend or auth API):

```console
curl http://localhost:7007/api/ocm/status
```

Or open http://localhost:7007/api/ocm/status in the browser after signing in through the frontend dev app.

### Frontend dev app

The backend alone is not enough for isolated plugin development. Start the frontend dev server as described in the [OCM frontend contributing guide](../ocm/CONTRIBUTING.md).
