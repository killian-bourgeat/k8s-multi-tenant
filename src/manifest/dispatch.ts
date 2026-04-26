import type { K8sCoreClient } from '../core/client.js';
import type { K8sManifest } from '../core/types.js';

/**
 * Dispatch tables: route a manifest to the right `@kubernetes/client-node`
 * method based on its `kind`. Kept separate from the orchestration logic
 * (idempotency, error handling) in service.ts so it stays readable.
 */

export async function createByKind(
  k8s: K8sCoreClient,
  resource: K8sManifest,
  ns: string,
): Promise<void> {
  const kind = resource.kind as string;
  switch (kind) {
    case 'Namespace':
      await k8s.core.createNamespace(resource); return;
    case 'ConfigMap':
      await k8s.core.createNamespacedConfigMap(ns, resource); return;
    case 'Secret':
      await k8s.core.createNamespacedSecret(ns, resource); return;
    case 'PersistentVolume':
      await k8s.core.createPersistentVolume(resource); return;
    case 'PersistentVolumeClaim':
      await k8s.core.createNamespacedPersistentVolumeClaim(ns, resource); return;
    case 'Deployment':
      await k8s.apps.createNamespacedDeployment(ns, resource); return;
    case 'StatefulSet':
      await k8s.apps.createNamespacedStatefulSet(ns, resource); return;
    case 'Service':
      await k8s.core.createNamespacedService(ns, resource); return;
    case 'Ingress':
      await k8s.networking.createNamespacedIngress(ns, resource); return;
    case 'Role':
      await k8s.rbac.createNamespacedRole(ns, resource); return;
    case 'RoleBinding':
      await k8s.rbac.createNamespacedRoleBinding(ns, resource as any); return;
    case 'ServiceAccount':
      await k8s.core.createNamespacedServiceAccount(ns, resource); return;
    case 'ClusterRoleBinding':
      await k8s.rbac.createClusterRoleBinding(resource as any); return;
    case 'HorizontalPodAutoscaler':
      await k8s.autoscaling.createNamespacedHorizontalPodAutoscaler(ns, resource); return;
    case 'CronJob':
      await k8s.batch.createNamespacedCronJob(ns, resource); return;
    case 'Job':
      await k8s.batch.createNamespacedJob(ns, resource); return;
    case 'PodDisruptionBudget':
      await k8s.policy.createNamespacedPodDisruptionBudget(ns, resource); return;
    default:
      throw new Error(`Unsupported resource kind: ${kind}`);
  }
}

export async function replaceByKind(
  k8s: K8sCoreClient,
  resource: K8sManifest,
  ns: string,
): Promise<void> {
  const kind = resource.kind as string;
  const name = resource.metadata?.name as string;
  switch (kind) {
    case 'Namespace':
      await k8s.core.replaceNamespace(name, resource); return;
    case 'ConfigMap':
      await k8s.core.replaceNamespacedConfigMap(name, ns, resource); return;
    case 'Secret':
      await k8s.core.replaceNamespacedSecret(name, ns, resource); return;
    case 'PersistentVolume':
      await k8s.core.replacePersistentVolume(name, resource); return;
    case 'PersistentVolumeClaim':
      await k8s.core.replaceNamespacedPersistentVolumeClaim(name, ns, resource); return;
    case 'Deployment':
      await k8s.apps.replaceNamespacedDeployment(name, ns, resource); return;
    case 'StatefulSet':
      await k8s.apps.replaceNamespacedStatefulSet(name, ns, resource); return;
    case 'Service':
      await k8s.core.replaceNamespacedService(name, ns, resource); return;
    case 'Ingress':
      await k8s.networking.replaceNamespacedIngress(name, ns, resource); return;
    case 'Role':
      await k8s.rbac.replaceNamespacedRole(name, ns, resource); return;
    case 'RoleBinding':
      await k8s.rbac.replaceNamespacedRoleBinding(name, ns, resource as any); return;
    case 'ServiceAccount':
      await k8s.core.replaceNamespacedServiceAccount(name, ns, resource); return;
    case 'ClusterRoleBinding':
      await k8s.rbac.replaceClusterRoleBinding(name, resource as any); return;
    case 'HorizontalPodAutoscaler':
      await k8s.autoscaling.replaceNamespacedHorizontalPodAutoscaler(name, ns, resource); return;
    case 'CronJob':
      await k8s.batch.replaceNamespacedCronJob(name, ns, resource); return;
    case 'Job':
      await k8s.batch.replaceNamespacedJob(name, ns, resource); return;
    case 'PodDisruptionBudget':
      await k8s.policy.replaceNamespacedPodDisruptionBudget(name, ns, resource); return;
    default:
      throw new Error(`Unsupported resource kind: ${kind}`);
  }
}

export async function deleteByKind(
  k8s: K8sCoreClient,
  kind: string,
  name: string,
  ns: string,
): Promise<void> {
  switch (kind) {
    case 'Namespace':
      await k8s.core.deleteNamespace(name); return;
    case 'ConfigMap':
      await k8s.core.deleteNamespacedConfigMap(name, ns); return;
    case 'Secret':
      await k8s.core.deleteNamespacedSecret(name, ns); return;
    case 'PersistentVolume':
      await k8s.core.deletePersistentVolume(name); return;
    case 'PersistentVolumeClaim':
      await k8s.core.deleteNamespacedPersistentVolumeClaim(name, ns); return;
    case 'Deployment':
      await k8s.apps.deleteNamespacedDeployment(name, ns); return;
    case 'StatefulSet':
      await k8s.apps.deleteNamespacedStatefulSet(name, ns); return;
    case 'Service':
      await k8s.core.deleteNamespacedService(name, ns); return;
    case 'Ingress':
      await k8s.networking.deleteNamespacedIngress(name, ns); return;
    case 'Role':
      await k8s.rbac.deleteNamespacedRole(name, ns); return;
    case 'RoleBinding':
      await k8s.rbac.deleteNamespacedRoleBinding(name, ns); return;
    case 'ServiceAccount':
      await k8s.core.deleteNamespacedServiceAccount(name, ns); return;
    case 'ClusterRoleBinding':
      await k8s.rbac.deleteClusterRoleBinding(name); return;
    case 'HorizontalPodAutoscaler':
      await k8s.autoscaling.deleteNamespacedHorizontalPodAutoscaler(name, ns); return;
    case 'CronJob':
      await k8s.batch.deleteNamespacedCronJob(name, ns); return;
    case 'Job':
      await k8s.batch.deleteNamespacedJob(name, ns); return;
    case 'PodDisruptionBudget':
      await k8s.policy.deleteNamespacedPodDisruptionBudget(name, ns); return;
    default:
      throw new Error(`Unsupported resource kind: ${kind}`);
  }
}
