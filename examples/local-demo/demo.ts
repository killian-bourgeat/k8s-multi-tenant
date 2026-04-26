/**
 * End-to-end demo against a local kind cluster. Walks through every service
 * of the lib in order:
 *   1. render a templated manifest
 *   2. apply it (Namespace + ConfigMap + Deployment + Service + Ingress)
 *   3. wait for the deployment to be ready
 *   4. read the pod logs
 *   5. exec a command inside the pod
 *   6. patch the ingress host (custom domain change)
 *   7. scale to 0, then back to 2
 *   8. delete the namespace (cascade-clean everything)
 *
 * Run with: `npx tsx demo.ts`
 *
 * Prerequisites:
 *   kind create cluster --name k8s-lib-demo
 *   kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
 *   kubectl wait --namespace ingress-nginx \
 *     --for=condition=ready pod \
 *     --selector=app.kubernetes.io/component=controller \
 *     --timeout=90s
 */

import { readFileSync } from 'node:fs';
import {
  K8sCertificateService,
  K8sCoreClient,
  K8sDeploymentService,
  K8sIngressService,
  K8sManifestService,
  K8sPodService,
  K8sTemplateEngine,
} from 'k8s-multitenants-saas';

const TENANT_ID = 'demo';
const HOST_INITIAL = 'demo.localtest.me';
const HOST_PATCHED = 'demo-renamed.localtest.me';
const NS = `tenant-${TENANT_ID}`;

async function main() {
  const core = new K8sCoreClient({
    kubeconfig: 'default',
    defaultNamespace: NS,
  });
  const manifests = new K8sManifestService(core);
  const deployments = new K8sDeploymentService(core);
  const ingresses = new K8sIngressService(core);
  const pods = new K8sPodService(core);
  const templates = new K8sTemplateEngine();

  // 1. Render the manifest with per-tenant variables
  const yaml = readFileSync(new URL('./manifest.yaml', import.meta.url), 'utf8');
  const rendered = templates.render(yaml, {
    TENANT_ID,
    HOST: HOST_INITIAL,
  });
  console.log(`✓ Rendered ${rendered.length} manifests`);

  // 2. Apply (idempotent — safe to re-run)
  await manifests.apply(rendered);
  console.log(`✓ Applied tenant bundle to namespace ${NS}`);

  // 3. Wait for the deployment to be Ready
  await deployments.waitForReady('nginx', { namespace: NS, timeoutMs: 60_000 });
  console.log(`✓ Deployment nginx is ready`);

  // 4. Read logs (one-shot)
  const podName = await firstPodName(core, 'nginx');
  const logs = await pods.readLogs({ pod: podName, namespace: NS, tailLines: 5 });
  console.log(`✓ Last 5 log lines from ${podName}:\n${logs.trim() || '(empty)'}`);

  // 5. Exec inside the pod
  const exec = await pods.execCommand({
    pod: podName,
    namespace: NS,
    command: ['sh', '-c', 'cat /usr/share/nginx/html/index.html | head -3'],
  });
  console.log(`✓ Exec exitCode=${exec.exitCode}, stdout:\n${exec.stdout.trim()}`);

  // 6. Patch the ingress host (simulating a custom domain change)
  await ingresses.updateHost({
    name: 'nginx',
    namespace: NS,
    host: HOST_PATCHED,
    updateTls: false,
  });
  console.log(`✓ Patched ingress host: ${HOST_INITIAL} → ${HOST_PATCHED}`);

  // 7. Scale down then up
  await deployments.scale('nginx', 0, NS);
  console.log(`✓ Scaled to 0 (tenant suspended)`);
  await deployments.scale('nginx', 2, NS);
  console.log(`✓ Scaled to 2 (tenant resumed)`);

  // 8. Cleanup
  await manifests.delete(
    { apiVersion: 'v1', kind: 'Namespace', metadata: { name: NS } },
  );
  console.log(`✓ Deleted namespace ${NS}`);

  console.log('\nDone. All 8 lib operations exercised against a real cluster.');
}

async function firstPodName(core: K8sCoreClient, app: string): Promise<string> {
  const res = await core.core.listNamespacedPod(NS);
  const pod = res.body.items.find((p) => p.metadata?.labels?.['app'] === app);
  if (!pod?.metadata?.name) throw new Error(`No pod found with label app=${app}`);
  return pod.metadata.name;
}

main().catch((err) => {
  console.error('✗ Demo failed:', err);
  process.exit(1);
});
