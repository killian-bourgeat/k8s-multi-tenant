import { Injectable, Logger } from '@nestjs/common';
import { K8sCoreClient } from '../core/client.js';
import type { K8sManifest } from '../core/types.js';
import { createByKind, replaceByKind, deleteByKind } from './dispatch.js';

/**
 * Apply / delete arbitrary Kubernetes manifests, idempotently.
 *
 * - `apply` creates the resource, or replaces it if it already exists (409).
 * - `delete` removes the resource, silently skipping 404s.
 *
 * The dispatch logic (which API client handles which `kind`) lives in
 * `dispatch.ts`. This service owns the idempotency + error handling.
 */
@Injectable()
export class K8sManifestService {
  private readonly logger = new Logger(K8sManifestService.name);

  constructor(private readonly k8s: K8sCoreClient) {}

  async apply(manifests: K8sManifest | K8sManifest[], namespace?: string): Promise<void> {
    const ns = this.k8s.resolveNamespace(namespace);
    const list = Array.isArray(manifests) ? manifests : [manifests];
    for (const resource of list) await this.applyOne(resource, ns);
  }

  async delete(manifests: K8sManifest | K8sManifest[], namespace?: string): Promise<void> {
    const ns = this.k8s.resolveNamespace(namespace);
    const list = Array.isArray(manifests) ? manifests : [manifests];
    for (const resource of list) await this.deleteOne(resource, ns);
  }

  private async applyOne(resource: K8sManifest, namespace: string): Promise<void> {
    try {
      await this.k8s.withRetry(() => createByKind(this.k8s, resource, namespace));
    } catch (err: any) {
      if (this.k8s.isAlreadyExistsError(err)) {
        this.logger.debug(`${resource.kind}/${resource.metadata?.name} exists, replacing.`);
        await this.k8s.withRetry(() => replaceByKind(this.k8s, resource, namespace));
      } else {
        throw err;
      }
    }
  }

  private async deleteOne(resource: K8sManifest, namespace: string): Promise<void> {
    const kind = resource.kind as string;
    const name = resource.metadata?.name as string;
    try {
      await this.k8s.withRetry(() => deleteByKind(this.k8s, kind, name, namespace));
    } catch (err: any) {
      if (this.k8s.isNotFoundError(err)) {
        this.logger.debug(`${kind}/${name} not found, skipping delete.`);
        return;
      }
      throw err;
    }
  }
}
