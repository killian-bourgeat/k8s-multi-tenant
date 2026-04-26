import { Inject, Injectable } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';
import { K8S_MODULE_OPTIONS, type K8sModuleOptions } from './types.js';

/**
 * Internal client owning the KubeConfig and the per-API-group clients.
 *
 * Other services (manifest, deployment, certificate, ingress, pod) inject
 * this to access the raw `@kubernetes/client-node` clients while keeping
 * their own API surface focused on a single concern.
 */
@Injectable()
export class K8sCoreClient {
  private kc!: k8s.KubeConfig;
  private _apps!: k8s.AppsV1Api;
  private _core!: k8s.CoreV1Api;
  private _rbac!: k8s.RbacAuthorizationV1Api;
  private _custom!: k8s.CustomObjectsApi;
  private _networking!: k8s.NetworkingV1Api;
  private _autoscaling!: k8s.AutoscalingV2Api;
  private _batch!: k8s.BatchV1Api;
  private _policy!: k8s.PolicyV1Api;
  private initialized = false;

  readonly defaultNamespace: string;
  readonly defaultPollMs: number;

  constructor(
    @Inject(K8S_MODULE_OPTIONS)
    private readonly options: K8sModuleOptions,
  ) {
    this.defaultNamespace = options.defaultNamespace ?? 'default';
    this.defaultPollMs = options.pollIntervalMs ?? 3000;
  }

  private ensureInitialized(): void {
    if (this.initialized) return;

    this.kc = new k8s.KubeConfig();
    const strategy = this.options.kubeconfig ?? 'auto';

    switch (strategy) {
      case 'in-cluster':
        this.kc.loadFromCluster();
        break;
      case 'default':
        this.kc.loadFromDefault();
        break;
      case 'custom':
        if (!this.options.customKubeconfig) {
          throw new Error('kubeconfig=custom requires customKubeconfig');
        }
        this.kc = this.options.customKubeconfig;
        break;
      case 'auto':
      default:
        this.kc.loadFromDefault();
        if (!this.kc.getCurrentCluster()) {
          this.kc.loadFromCluster();
        }
        break;
    }

    this._apps = this.kc.makeApiClient(k8s.AppsV1Api);
    this._core = this.kc.makeApiClient(k8s.CoreV1Api);
    this._rbac = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api);
    this._custom = this.kc.makeApiClient(k8s.CustomObjectsApi);
    this._networking = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this._autoscaling = this.kc.makeApiClient(k8s.AutoscalingV2Api);
    this._batch = this.kc.makeApiClient(k8s.BatchV1Api);
    this._policy = this.kc.makeApiClient(k8s.PolicyV1Api);

    this.initialized = true;
  }

  get kubeConfig(): k8s.KubeConfig {
    this.ensureInitialized();
    return this.kc;
  }
  get apps(): k8s.AppsV1Api { this.ensureInitialized(); return this._apps; }
  get core(): k8s.CoreV1Api { this.ensureInitialized(); return this._core; }
  get rbac(): k8s.RbacAuthorizationV1Api { this.ensureInitialized(); return this._rbac; }
  get custom(): k8s.CustomObjectsApi { this.ensureInitialized(); return this._custom; }
  get networking(): k8s.NetworkingV1Api { this.ensureInitialized(); return this._networking; }
  get autoscaling(): k8s.AutoscalingV2Api { this.ensureInitialized(); return this._autoscaling; }
  get batch(): k8s.BatchV1Api { this.ensureInitialized(); return this._batch; }
  get policy(): k8s.PolicyV1Api { this.ensureInitialized(); return this._policy; }

  resolveNamespace(ns?: string): string {
    return ns ?? this.defaultNamespace;
  }

  isAlreadyExistsError(err: any): boolean {
    return err?.response?.statusCode === 409 || err?.statusCode === 409;
  }

  isNotFoundError(err: any): boolean {
    return err?.response?.statusCode === 404 || err?.statusCode === 404;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
