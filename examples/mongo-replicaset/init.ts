/**
 * Initialize the MongoDB replica set programmatically — replaces the bash
 * script + `kubectl exec` workflow you'd usually keep around to bootstrap
 * `rs.initiate(...)`.
 *
 * This is the kind of one-off pod operation that K8sPodService is built for.
 */

import {
  K8sCoreClient,
  K8sManifestService,
  K8sDeploymentService,
  K8sPodService,
  K8sTemplateEngine,
} from 'k8s-multitenants-saas';
import { readFileSync } from 'node:fs';

export async function provisionTenantMongo(opts: {
  tenantId: string;
  storage?: string;
  mongoTag?: string;
}) {
  const core = new K8sCoreClient({
    kubeconfig: 'auto',
    defaultNamespace: `tenant-${opts.tenantId}`,
  });
  const manifests = new K8sManifestService(core);
  const deployments = new K8sDeploymentService(core);
  const pods = new K8sPodService(core);
  const templates = new K8sTemplateEngine();

  const ns = `tenant-${opts.tenantId}`;

  // 1. Render and apply the StatefulSet + headless Service
  const yaml = readFileSync(
    new URL('./all.yaml', import.meta.url),
    'utf8',
  );
  const rendered = templates.render(yaml, {
    TENANT_ID: opts.tenantId,
    STORAGE: opts.storage ?? '10Gi',
    MONGO_TAG: opts.mongoTag ?? '7.0',
  });
  await manifests.apply(rendered, ns);

  // 2. Wait for the first replica to be Ready before exec-ing into it
  await deployments.waitForReady(`mongo-${opts.tenantId}`, {
    namespace: ns,
    timeoutMs: 5 * 60_000,
  });

  // 3. Initiate the replica set inside mongo-0 — programmatically,
  //    no shell scripts required.
  const member0 = `mongo-${opts.tenantId}-0.mongo-${opts.tenantId}.${ns}.svc.cluster.local:27017`;
  const member1 = `mongo-${opts.tenantId}-1.mongo-${opts.tenantId}.${ns}.svc.cluster.local:27017`;

  const result = await pods.execCommand({
    pod: `mongo-${opts.tenantId}-0`,
    namespace: ns,
    command: [
      'mongosh',
      '--quiet',
      '--eval',
      `rs.initiate({
        _id: "rs0",
        members: [
          { _id: 0, host: "${member0}" },
          { _id: 1, host: "${member1}" }
        ]
      })`,
    ],
  });

  if (!result.success) {
    throw new Error(`Failed to initiate replica set: ${result.stderr}`);
  }

  return { initiated: true, primary: `mongo-${opts.tenantId}-0` };
}
