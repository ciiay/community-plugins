# Setting up the development environment for OCM plugin

## Full workspace (app + backend)

From the OCM workspace root (`workspaces/ocm`), run:

```console
yarn start
```

Then open `http://localhost:3000/ocm`.

This starts the example Backstage app and full backend together. Use this when you need the complete application stack.

## Isolated plugin development (recommended)

For faster startup and hot reload while working on the OCM plugin, run the backend and frontend dev servers in **two separate terminals**. Both read config from `workspaces/ocm/app-config.yaml` and `workspaces/ocm/app-config.local.yaml`.

### 1. Start the backend

```console
cd workspaces/ocm/plugins/ocm-backend
LEGACY_BACKEND_START=true yarn start
```

Wait until the backend is listening on port **7007** and plugins `auth`, `catalog`, and `ocm` have initialized.

The backend dev entry (`plugins/ocm-backend/dev/index.ts`) starts an MSW mock server for the Kubernetes API at `https://example.com` and loads the guest auth provider so the frontend can call `/api/ocm/status`. See [OCM backend contributing guide](../ocm-backend/CONTRIBUTING.md) for details.

### 2. Start the frontend

In a second terminal:

```console
cd workspaces/ocm/plugins/ocm
yarn start
```

Wait until Rspack reports a successful compile.

### 3. Open the dev app

| Page                     | URL                                                |
| ------------------------ | -------------------------------------------------- |
| Managed clusters list    | http://localhost:3000/ocm                          |
| Cluster detail (example) | http://localhost:3000/catalog/resource/default/foo |

Sign in as **guest** if prompted. The dev app mocks catalog entities for `foo`, `cluster1`, and `offline-cluster`; cluster status data is fetched from the backend at `http://localhost:7007/api/ocm/status`.

### Notes

- Both terminals must stay running.
- The frontend dev app only mocks the catalog API. It still requires the OCM backend for cluster status and entity detail pages.
- Dev setup lives in the `./dev` directories of each plugin package and does not affect published plugin behavior.
