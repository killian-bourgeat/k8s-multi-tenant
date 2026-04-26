export { KubernetesModule } from './module.js';

export { K8sCoreClient } from './core/client.js';
export {
  K8S_MODULE_OPTIONS,
  type K8sManifest,
  type K8sModuleOptions,
  type WaitOptions,
  type IngressHostUpdate,
} from './core/types.js';
export {
  NETWORKING_API,
  CERT_MANAGER_API,
  JSON_PATCH_CONTENT_TYPE,
} from './core/constants.js';

export { K8sManifestService } from './manifest/service.js';
export { K8sDeploymentService } from './deployment/service.js';
export { K8sCertificateService } from './certificate/service.js';
export { K8sIngressService } from './ingress/service.js';
export {
  K8sPodService,
  type ExecOptions,
  type ExecResult,
  type LogReadOptions,
  type LogStreamOptions,
} from './pod/index.js';
export { K8sTemplateEngine } from './template/engine.js';
