# Examples

Three complete examples showing what `k8s-multitenants-saas` can apply, patch
and orchestrate. All YAML manifests use the `${VAR}` syntax of
`K8sTemplateEngine` so you can render them per-tenant from your backend.

| Example | What it shows |
|---|---|
| [`tenant-bundle/`](./tenant-bundle/) | A full tenant: Namespace + ConfigMap + Secret + Deployment + Service + Ingress + PodDisruptionBudget + Certificate |
| [`mongo-replicaset/`](./mongo-replicaset/) | A 2-node MongoDB StatefulSet bootstrapped via `pods.execCommand` (replaces the `kubectl exec` bash scripts you'd usually write) |
| [`local-demo/`](./local-demo/) | A runnable end-to-end demo against a local `kind` cluster — apply → wait → patch → exec → delete |

## Quick start

```bash
# Spin up a local cluster
kind create cluster --name k8s-lib-demo

# Run the local demo (provisions a tenant, patches its ingress, scales it,
# and tears it all down)
cd examples/local-demo
npm install
npx tsx demo.ts
```

## Templating

Every YAML in these folders uses `${VAR}` placeholders. Render them at runtime
with `K8sTemplateEngine`:

```ts
import { readFileSync } from 'fs';
import { K8sTemplateEngine } from 'k8s-multitenants-saas';

const yaml = readFileSync('examples/tenant-bundle/all.yaml', 'utf8');
const manifests = templates.render(yaml, {
  TENANT_ID: 'acme-42',
  HOST: 'shop.acme.com',
  IMAGE: 'ghcr.io/myorg/storefront:1.4.2',
  REPLICAS: '2',
});

await manifestsService.apply(manifests, `tenant-${tenantId}`);
```

The engine does string substitution only — no logic, no conditionals. If you
need control flow, render a Helm template upstream and feed the output
through this lib for the apply step.
