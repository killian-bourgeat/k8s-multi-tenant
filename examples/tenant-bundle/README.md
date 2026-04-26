# Tenant bundle

A complete per-tenant bundle: everything you need to provision an isolated
tenant on a shared cluster.

## What it creates

| Resource | Purpose |
|---|---|
| `Namespace tenant-${TENANT_ID}` | Isolation boundary |
| `ConfigMap app-config` | Non-secret tenant config |
| `Secret app-secrets` | API keys, tokens (never commit values) |
| `Deployment app-${TENANT_ID}` | The tenant's application pods |
| `Service app-${TENANT_ID}` | ClusterIP service for the deployment |
| `PodDisruptionBudget` | Ensures availability during cluster operations |
| `Ingress ingress-${TENANT_ID}` | Routes `${HOST}` → service |
| `Certificate cert-${TENANT_ID}` | TLS via cert-manager + ${ISSUER} |

## Variables

| Variable | Example | Required |
|---|---|---|
| `TENANT_ID` | `acme-42` | ✅ |
| `HOST` | `shop.acme.com` | ✅ |
| `IMAGE` | `ghcr.io/org/storefront:1.4.2` | ✅ |
| `REPLICAS` | `2` | ✅ |
| `ISSUER` | `letsencrypt-prod` | ✅ |
| `API_KEY` | (per-tenant) | ✅ |

## Use it

```ts
import { readFileSync } from 'fs';

const yaml = readFileSync('examples/tenant-bundle/all.yaml', 'utf8');
const manifests = templates.render(yaml, {
  TENANT_ID: 'acme-42',
  HOST: 'shop.acme.com',
  IMAGE: 'ghcr.io/org/storefront:1.4.2',
  REPLICAS: '2',
  ISSUER: 'letsencrypt-prod',
  API_KEY: await secrets.fetchFor('acme-42'),
});

await manifestsService.apply(manifests);
await deployments.waitForReady(`app-acme-42`, { namespace: 'tenant-acme-42' });
await certificates.waitForReady(`cert-acme-42`, { namespace: 'tenant-acme-42' });
```

## Patching the host later

When the tenant updates their custom domain, you don't re-apply the whole
bundle — just patch the ingress:

```ts
await ingresses.updateHost({
  name: 'ingress-acme-42',
  namespace: 'tenant-acme-42',
  host: 'newdomain.acme.com',
});
await certificates.delete('cert-acme-42', 'tenant-acme-42');
// re-apply the cert with the new dnsNames
```
