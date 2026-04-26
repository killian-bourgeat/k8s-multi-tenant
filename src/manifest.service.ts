import { Injectable, Logger } from '@nestjs/common';
import { K8sCoreClient } from './k8s-core.client.js';
import type { K8sManifest } from './types.js';

/**
 * Apply / delete arbitrary Kubernetes manifests, idempotently.
 *
 * - `apply` creates the resource, or replaces it if it already exists (409).
 * - `delete` removes the resource, silently skipping 404s.
 *
 * Supported kinds: Namespace, ConfigMap, Secret, PersistentVolume,
 * PersistentVolumeClaim, Deployment, StatefulSet, Service, Ingress, Role,
 * RoleBinding, ServiceAccount, ClusterRoleBinding, HorizontalPodAutoscaler,
 * CronJob, Job, PodDisruptionBudget.
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
      await this.create(resource, namespace);
    } catch (err: any) {
      if (this.k8s.isAlreadyExistsError(err)) {
        this.logger.debug(`${resource.kind}/${resource.metadata?.name} exists, replacing.`);
        await this.replace(resource, namespace);
      } else {
        throw err;
      }
    }
  }

  private async deleteOne(resource: K8sManifest, namespace: string): Promise<void> {
    const kind = resource.kind as string;
    const name = resource.metadata?.name as string;
    try {
      await this.deleteByKind(kind, name, namespace);
    } catch (err: any) {
      if (this.k8s.isNotFoundError(err)) {
        this.logger.debug(`${kind}/${name} not found, skipping delete.`);
        return;
      }
      throw err;
    }
  }

  private async create(resource: K8sManifest, ns: string): Promise<void> {
    const kind = resource.kind as string;
    switch (kind) {
      case 'Namespace':
        await this.k8s.core.createNamespace(resource); return;
      case 'ConfigMap':
        await this.k8s.core.createNamespacedConfigMap(ns, resource); return;
      case 'Secret':
        await this.k8s.core.createNamespacedSecret(ns, resource); return;
      case 'PersistentVolume':
        await this.k8s.core.createPersistentVolume(resource); return;
      case 'PersistentVolumeClaim':
        await this.k8s.core.createNamespacedPersistentVolumeClaim(ns, resource); return;
      case 'Deployment':
        await this.k8s.apps.createNamespacedDeployment(ns, resource); return;
      case 'StatefulSet':
        await this.k8s.apps.createNamespacedStatefulSet(ns, resource); return;
      case 'Service':
        await this.k8s.core.createNamespacedService(ns, resource); return;
      case 'Ingress':
        await this.k8s.networking.createNamespacedIngress(ns, resource); return;
      case 'Role':
        await this.k8s.rbac.createNamespacedRole(ns, resource); return;
      case 'RoleBinding':
        await this.k8s.rbac.createNamespacedRoleBinding(ns, resource as any); return;
      case 'ServiceAccount':
        await this.k8s.core.createNamespacedServiceAccount(ns, resource); return;
      case 'ClusterRoleBinding':
        await this.k8s.rbac.createClusterRoleBinding(resource as any); return;
      case 'HorizontalPodAutoscaler':
        await this.k8s.autoscaling.createNamespacedHorizontalPodAutoscaler(ns, resource); return;
      case 'CronJob':
        await this.k8s.batch.createNamespacedCronJob(ns, resource); return;
      case 'Job':
        await this.k8s.batch.createNamespacedJob(ns, resource); return;
      case 'PodDisruptionBudget':
        await this.k8s.policy.createNamespacedPodDisruptionBudget(ns, resource); return;
      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }
  }

  private async replace(resource: K8sManifest, ns: string): Promise<void> {
    const kind = resource.kind as string;
    const name = resource.metadata?.name as string;
    switch (kind) {
      case 'Namespace':
        await this.k8s.core.replaceNamespace(name, resource); return;
      case 'ConfigMap':
        await this.k8s.core.replaceNamespacedConfigMap(name, ns, resource); return;
      case 'Secret':
        await this.k8s.core.replaceNamespacedSecret(name, ns, resource); return;
      case 'PersistentVolume':
        await this.k8s.core.replacePersistentVolume(name, resource); return;
      case 'PersistentVolumeClaim':
        await this.k8s.core.replaceNamespacedPersistentVolumeClaim(name, ns, resource); return;
      case 'Deployment':
        await this.k8s.apps.replaceNamespacedDeployment(name, ns, resource); return;
      case 'StatefulSet':
        await this.k8s.apps.replaceNamespacedStatefulSet(name, ns, resource); return;
      case 'Service':
        await this.k8s.core.replaceNamespacedService(name, ns, resource); return;
      case 'Ingress':
        await this.k8s.networking.replaceNamespacedIngress(name, ns, resource); return;
      case 'Role':
        await this.k8s.rbac.replaceNamespacedRole(name, ns, resource); return;
      case 'RoleBinding':
        await this.k8s.rbac.replaceNamespacedRoleBinding(name, ns, resource as any); return;
      case 'ServiceAccount':
        await this.k8s.core.replaceNamespacedServiceAccount(name, ns, resource); return;
      case 'ClusterRoleBinding':
        await this.k8s.rbac.replaceClusterRoleBinding(name, resource as any); return;
      case 'HorizontalPodAutoscaler':
        await this.k8s.autoscaling.replaceNamespacedHorizontalPodAutoscaler(name, ns, resource); return;
      case 'CronJob':
        await this.k8s.batch.replaceNamespacedCronJob(name, ns, resource); return;
      case 'Job':
        await this.k8s.batch.replaceNamespacedJob(name, ns, resource); return;
      case 'PodDisruptionBudget':
        await this.k8s.policy.replaceNamespacedPodDisruptionBudget(name, ns, resource); return;
      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }
  }

  private async deleteByKind(kind: string, name: string, ns: string): Promise<void> {
    switch (kind) {
      case 'Namespace':
        await this.k8s.core.deleteNamespace(name); return;
      case 'ConfigMap':
        await this.k8s.core.deleteNamespacedConfigMap(name, ns); return;
      case 'Secret':
        await this.k8s.core.deleteNamespacedSecret(name, ns); return;
      case 'PersistentVolume':
        await this.k8s.core.deletePersistentVolume(name); return;
      case 'PersistentVolumeClaim':
        await this.k8s.core.deleteNamespacedPersistentVolumeClaim(name, ns); return;
      case 'Deployment':
        await this.k8s.apps.deleteNamespacedDeployment(name, ns); return;
      case 'StatefulSet':
        await this.k8s.apps.deleteNamespacedStatefulSet(name, ns); return;
      case 'Service':
        await this.k8s.core.deleteNamespacedService(name, ns); return;
      case 'Ingress':
        await this.k8s.networking.deleteNamespacedIngress(name, ns); return;
      case 'Role':
        await this.k8s.rbac.deleteNamespacedRole(name, ns); return;
      case 'RoleBinding':
        await this.k8s.rbac.deleteNamespacedRoleBinding(name, ns); return;
      case 'ServiceAccount':
        await this.k8s.core.deleteNamespacedServiceAccount(name, ns); return;
      case 'ClusterRoleBinding':
        await this.k8s.rbac.deleteClusterRoleBinding(name); return;
      case 'HorizontalPodAutoscaler':
        await this.k8s.autoscaling.deleteNamespacedHorizontalPodAutoscaler(name, ns); return;
      case 'CronJob':
        await this.k8s.batch.deleteNamespacedCronJob(name, ns); return;
      case 'Job':
        await this.k8s.batch.deleteNamespacedJob(name, ns); return;
      case 'PodDisruptionBudget':
        await this.k8s.policy.deleteNamespacedPodDisruptionBudget(name, ns); return;
      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }
  }
}
