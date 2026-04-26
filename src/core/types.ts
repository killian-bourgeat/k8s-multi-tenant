import type * as k8s from '@kubernetes/client-node';
import type { RetryOptions } from './retry.js';

export type K8sManifest = Record<string, any>;

export interface K8sModuleOptions {
  /**
   * Kubeconfig loading strategy.
   * - `auto` (default): try in-cluster first, fall back to default kubeconfig.
   * - `in-cluster`: only load from in-cluster service account.
   * - `default`: only load from `~/.kube/config` or KUBECONFIG env var.
   * - `custom`: provide your own KubeConfig instance.
   */
  kubeconfig?: 'auto' | 'in-cluster' | 'default' | 'custom';

  /** Pre-configured KubeConfig instance. Required when `kubeconfig` is `custom`. */
  customKubeconfig?: k8s.KubeConfig;

  /** Default namespace used when an operation does not specify one. @default 'default' */
  defaultNamespace?: string;

  /** Retry policy applied to imperative operations (apply, delete, scale, patch). */
  retry?: RetryOptions;
}

export interface WaitOptions {
  /** Maximum time to wait, in milliseconds. */
  timeoutMs?: number;
  /** Optional namespace override. */
  namespace?: string;
}

export interface IngressHostUpdate {
  /** Ingress resource name. */
  name: string;
  /** New hostname (e.g. `shop.example.com`). */
  host: string;
  /** Whether to also update the TLS hosts list. @default true */
  updateTls?: boolean;
  /** Optional namespace override. */
  namespace?: string;
}

export const K8S_MODULE_OPTIONS = Symbol('K8S_MODULE_OPTIONS');
