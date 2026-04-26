import { Injectable } from '@nestjs/common';
import { Watch } from '@kubernetes/client-node';
import { K8sCoreClient } from '../core/client.js';
import { CERT_MANAGER_API } from '../core/constants.js';
import type { WaitOptions } from '../core/types.js';

/**
 * Operations on cert-manager `Certificate` resources.
 *
 * `waitForReady` uses the Kubernetes watch API (push, not polling) to
 * resolve as soon as the Certificate's `Ready=True` condition appears.
 */
@Injectable()
export class K8sCertificateService {
  constructor(private readonly k8s: K8sCoreClient) {}

  async waitForReady(name: string, options: WaitOptions = {}): Promise<void> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

    // Initial read — short-circuits if the cert is already issued.
    try {
      const cert = await this.k8s.custom.getNamespacedCustomObject(
        CERT_MANAGER_API.group,
        CERT_MANAGER_API.version,
        ns,
        CERT_MANAGER_API.plural.certificates,
        name,
      );
      if (isReady(cert.body)) return;
    } catch (err: any) {
      if (!this.k8s.isNotFoundError(err)) throw err;
    }

    await watchUntilReady({
      k8s: this.k8s,
      path: `/apis/${CERT_MANAGER_API.group}/${CERT_MANAGER_API.version}/namespaces/${ns}/${CERT_MANAGER_API.plural.certificates}`,
      name,
      timeoutMs,
      timeoutMessage: `Timeout: certificate "${name}" not ready after ${timeoutMs}ms`,
      isReady,
    });
  }

  async delete(name: string, namespace?: string): Promise<void> {
    const ns = this.k8s.resolveNamespace(namespace);
    try {
      await this.k8s.withRetry(() =>
        this.k8s.custom.deleteNamespacedCustomObject(
          CERT_MANAGER_API.group,
          CERT_MANAGER_API.version,
          ns,
          CERT_MANAGER_API.plural.certificates,
          name,
        ),
      );
    } catch (err: any) {
      if (!this.k8s.isNotFoundError(err)) throw err;
    }
  }
}

function isReady(cert: any): boolean {
  const conditions = cert?.status?.conditions ?? [];
  return conditions.some(
    (c: any) => c.type === 'Ready' && c.status === 'True',
  );
}

interface WatchUntilOptions {
  k8s: K8sCoreClient;
  path: string;
  name: string;
  timeoutMs: number;
  timeoutMessage: string;
  isReady: (obj: any) => boolean;
}

async function watchUntilReady(opts: WatchUntilOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const watch = new Watch(opts.k8s.kubeConfig);
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
      () => settle(() => reject(new Error(opts.timeoutMessage))),
      opts.timeoutMs,
    );

    watch
      .watch(
        opts.path,
        { fieldSelector: `metadata.name=${opts.name}` },
        (_phase: string, obj: any) => {
          if (opts.isReady(obj)) settle(() => resolve());
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
