import { Injectable } from '@nestjs/common';
import { Watch } from '@kubernetes/client-node';
import { K8sCoreClient } from '../core/client.js';
import type { WaitOptions } from '../core/types.js';

/**
 * Operations on Deployments: scaling and readiness.
 *
 * `waitForReady` uses the Kubernetes watch API on the Deployment itself
 * (not its pods) and resolves as soon as `status.readyReplicas === spec.replicas`.
 */
@Injectable()
export class K8sDeploymentService {
  constructor(private readonly k8s: K8sCoreClient) {}

  async scale(name: string, replicas: number, namespace?: string): Promise<void> {
    const ns = this.k8s.resolveNamespace(namespace);
    await this.k8s.withRetry(async () => {
      const res = await this.k8s.apps.readNamespacedDeployment(name, ns);
      const deployment = res.body;
      deployment.spec!.replicas = replicas;
      await this.k8s.apps.replaceNamespacedDeployment(name, ns, deployment);
    });
  }

  async getReplicas(name: string, namespace?: string): Promise<number> {
    const ns = this.k8s.resolveNamespace(namespace);
    return this.k8s.withRetry(async () => {
      const res = await this.k8s.apps.readNamespacedDeployment(name, ns);
      return res.body.spec?.replicas ?? 0;
    });
  }

  async waitForReady(name: string, options: WaitOptions = {}): Promise<void> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;

    // Initial read — short-circuits if the deployment is already ready.
    try {
      const res = await this.k8s.apps.readNamespacedDeployment(name, ns);
      if (isDeploymentReady(res.body)) return;
    } catch (err: any) {
      if (!this.k8s.isNotFoundError(err)) throw err;
    }

    await new Promise<void>((resolve, reject) => {
      const watch = new Watch(this.k8s.kubeConfig);
      let req: any;
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { req?.abort?.(); } catch { /* ignore */ }
        fn();
      };

      const timer = setTimeout(
        () =>
          settle(() =>
            reject(
              new Error(
                `Timeout: deployment "${name}" not ready after ${timeoutMs}ms`,
              ),
            ),
          ),
        timeoutMs,
      );

      watch
        .watch(
          `/apis/apps/v1/namespaces/${ns}/deployments`,
          { fieldSelector: `metadata.name=${name}` },
          (_phase: string, obj: any) => {
            if (isDeploymentReady(obj)) settle(() => resolve());
          },
          (err) => {
            if (settled) return;
            settle(() => reject(err ?? new Error('Watch ended unexpectedly')));
          },
        )
        .then((r) => { req = r; })
        .catch((err) => settle(() => reject(err)));
    });
  }
}

function isDeploymentReady(dep: any): boolean {
  const desired = dep?.spec?.replicas ?? 0;
  const ready = dep?.status?.readyReplicas ?? 0;
  return desired > 0 && ready === desired;
}
