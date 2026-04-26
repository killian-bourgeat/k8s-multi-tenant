import { Injectable, Logger } from '@nestjs/common';
import { K8sCoreClient } from './k8s-core.client.js';
import type { WaitOptions } from './types.js';

const CERT_MANAGER_GROUP = 'cert-manager.io';
const CERT_MANAGER_VERSION = 'v1';
const CERT_MANAGER_PLURAL = 'certificates';

/**
 * Operations on cert-manager `Certificate` resources.
 *
 * Useful when provisioning TLS for a freshly created tenant domain — wait
 * for the certificate to be issued before flipping the tenant to "active".
 */
@Injectable()
export class K8sCertificateService {
  private readonly logger = new Logger(K8sCertificateService.name);

  constructor(private readonly k8s: K8sCoreClient) {}

  async waitForReady(name: string, options: WaitOptions = {}): Promise<void> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
    const pollMs = options.pollIntervalMs ?? this.k8s.defaultPollMs;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const cert = await this.k8s.custom.getNamespacedCustomObject(
          CERT_MANAGER_GROUP,
          CERT_MANAGER_VERSION,
          ns,
          CERT_MANAGER_PLURAL,
          name,
        );
        const conditions = (cert.body as any).status?.conditions ?? [];
        const ready = conditions.some(
          (c: any) => c.type === 'Ready' && c.status === 'True',
        );
        if (ready) return;
      } catch (err: any) {
        if (!this.k8s.isNotFoundError(err)) throw err;
      }

      await this.k8s.sleep(pollMs);
    }

    throw new Error(
      `Timeout: certificate "${name}" not ready after ${timeoutMs}ms`,
    );
  }

  async delete(name: string, namespace?: string): Promise<void> {
    const ns = this.k8s.resolveNamespace(namespace);
    try {
      await this.k8s.custom.deleteNamespacedCustomObject(
        CERT_MANAGER_GROUP,
        CERT_MANAGER_VERSION,
        ns,
        CERT_MANAGER_PLURAL,
        name,
      );
    } catch (err: any) {
      if (!this.k8s.isNotFoundError(err)) throw err;
    }
  }
}
