import { Injectable } from '@nestjs/common';
import { K8sCoreClient } from '../core/client.js';
import { NETWORKING_API, JSON_PATCH_CONTENT_TYPE } from '../core/constants.js';
import type { IngressHostUpdate } from '../core/types.js';

/**
 * Operations on Ingress resources, focused on the multi-tenant SaaS use
 * case of swapping the host (and TLS hosts) when a tenant adds or changes
 * a custom domain.
 */
@Injectable()
export class K8sIngressService {
  constructor(private readonly k8s: K8sCoreClient) {}

  /**
   * JSON-patch an existing Ingress to update its host (and optionally the
   * TLS hosts list). Use this when a tenant maps their own domain to the
   * same backend service.
   */
  async updateHost(update: IngressHostUpdate): Promise<void> {
    const ns = this.k8s.resolveNamespace(update.namespace);
    const updateTls = update.updateTls ?? true;

    const patch: Array<Record<string, unknown>> = [
      { op: 'replace', path: '/spec/rules/0/host', value: update.host },
    ];
    if (updateTls) {
      patch.push({
        op: 'replace',
        path: '/spec/tls/0/hosts',
        value: [update.host],
      });
    }

    await this.k8s.custom.patchNamespacedCustomObject(
      NETWORKING_API.group,
      NETWORKING_API.version,
      ns,
      NETWORKING_API.plural.ingresses,
      update.name,
      patch,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': JSON_PATCH_CONTENT_TYPE } },
    );
  }
}
