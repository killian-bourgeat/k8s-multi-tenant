# MongoDB replica set per tenant

A 2-node MongoDB replica set bootstrapped programmatically via
`K8sPodService.execCommand` — no bash scripts, no `kubectl exec` from
your CI.

## What it shows

This is the canonical use case for `pods.execCommand`: after applying a
StatefulSet, you need to **initiate** the replica set by running
`rs.initiate(...)` inside the first pod. Most teams do this with a bash
script wrapped around `kubectl exec`. With this lib it's one TypeScript
function.

## Files

- [`all.yaml`](./all.yaml) — Service (headless) + StatefulSet (2 replicas)
- [`init.ts`](./init.ts) — Apply manifests, wait for pod ready, exec
  `rs.initiate` inside `mongo-0`

## Usage

```ts
import { provisionTenantMongo } from './init.js';

await provisionTenantMongo({
  tenantId: 'acme-42',
  storage: '20Gi',
  mongoTag: '7.0',
});
// → tenant has a primary mongo-acme-42-0 with a healthy replica
```

## Variables

| Variable | Default | Description |
|---|---|---|
| `TENANT_ID` | (required) | Unique tenant slug |
| `STORAGE` | `10Gi` | PVC size per replica |
| `MONGO_TAG` | `7.0` | MongoDB image tag |
