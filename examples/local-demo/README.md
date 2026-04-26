# Local demo on `kind`

End-to-end demo of every service in the lib, against a real local
Kubernetes cluster (`kind`). Takes ~2 minutes from cluster creation to
finished demo.

## Setup

```bash
# 1. Install prerequisites
brew install kind kubectl
npm install -g tsx

# 2. Spin up the cluster
kind create cluster --name k8s-lib-demo

# 3. Install nginx ingress controller (required for the ingress patch step)
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# 4. Install lib deps from this folder
cd examples/local-demo
npm install
```

## Run

```bash
npx tsx demo.ts
```

Expected output:

```
✓ Rendered 5 manifests
✓ Applied tenant bundle to namespace tenant-demo
✓ Deployment nginx is ready
✓ Last 5 log lines from nginx-...: ...
✓ Exec exitCode=0, stdout:
  <html>
    <body>
      <h1>Hello from tenant demo</h1>
✓ Patched ingress host: demo.localtest.me → demo-renamed.localtest.me
✓ Scaled to 0 (tenant suspended)
✓ Scaled to 2 (tenant resumed)
✓ Deleted namespace tenant-demo

Done. All 8 lib operations exercised against a real cluster.
```

## What it exercises

| Step | Service | Method |
|---|---|---|
| 1 | `K8sTemplateEngine` | `render` |
| 2 | `K8sManifestService` | `apply` |
| 3 | `K8sDeploymentService` | `waitForReady` |
| 4 | `K8sPodService` | `readLogs` |
| 5 | `K8sPodService` | `execCommand` |
| 6 | `K8sIngressService` | `updateHost` |
| 7 | `K8sDeploymentService` | `scale` |
| 8 | `K8sManifestService` | `delete` |

If all 8 steps pass, the lib's core surface works against a real cluster.

## Cleanup

```bash
kind delete cluster --name k8s-lib-demo
```
