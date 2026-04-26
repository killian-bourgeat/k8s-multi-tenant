import { Injectable, Logger } from '@nestjs/common';
import { K8sCoreClient } from './k8s-core.client.js';
import type { WaitOptions } from './types.js';

/**
 * Operations on Deployments: scaling and readiness.
 */
@Injectable()
export class K8sDeploymentService {
  constructor(private readonly k8s: K8sCoreClient) {}

  async scale(name: string, replicas: number, namespace?: string): Promise<void> {
    const ns = this.k8s.resolveNamespace(namespace);
    const res = await this.k8s.apps.readNamespacedDeployment(name, ns);
    const deployment = res.body;
    deployment.spec!.replicas = replicas;
    await this.k8s.apps.replaceNamespacedDeployment(name, ns, deployment);
  }

  async getReplicas(name: string, namespace?: string): Promise<number> {
    const ns = this.k8s.resolveNamespace(namespace);
    const res = await this.k8s.apps.readNamespacedDeployment(name, ns);
    return res.body.spec?.replicas ?? 0;
  }

  /**
   * Poll until all pods labeled `app=<name>` are in `Running` phase AND
   * have a `Ready=True` condition.
   */
  async waitForReady(name: string, options: WaitOptions = {}): Promise<void> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    const pollMs = options.pollIntervalMs ?? this.k8s.defaultPollMs;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const podsRes = await this.k8s.core.listNamespacedPod(ns);
      const pods = podsRes.body.items.filter(
        (p) => p.metadata?.labels?.['app'] === name,
      );

      if (pods.length > 0) {
        const allRunning = pods.every((p) => p.status?.phase === 'Running');
        const allReady = pods.every((p) =>
          p.status?.conditions?.some(
            (c) => c.type === 'Ready' && c.status === 'True',
          ),
        );
        if (allRunning && allReady) return;
      }

      await this.k8s.sleep(pollMs);
    }

    throw new Error(
      `Timeout: deployment "${name}" pods not ready after ${timeoutMs}ms`,
    );
  }
}
