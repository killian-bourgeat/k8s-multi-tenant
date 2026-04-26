import { DynamicModule, Module } from '@nestjs/common';
import { K8S_MODULE_OPTIONS, type K8sModuleOptions } from './types.js';
import { K8sCoreClient } from './k8s-core.client.js';
import { K8sManifestService } from './manifest.service.js';
import { K8sDeploymentService } from './deployment.service.js';
import { K8sCertificateService } from './certificate.service.js';
import { K8sIngressService } from './ingress.service.js';
import { K8sPodService } from './pod.service.js';
import { K8sTemplateEngine } from './template-engine.js';

const PROVIDERS = [
  K8sCoreClient,
  K8sManifestService,
  K8sDeploymentService,
  K8sCertificateService,
  K8sIngressService,
  K8sPodService,
  K8sTemplateEngine,
];

@Module({})
export class KubernetesModule {
  static forRoot(options: K8sModuleOptions = {}): DynamicModule {
    return {
      module: KubernetesModule,
      providers: [
        { provide: K8S_MODULE_OPTIONS, useValue: options },
        ...PROVIDERS,
      ],
      exports: PROVIDERS,
      global: true,
    };
  }

  static forRootAsync(asyncOptions: {
    useFactory: (...args: unknown[]) => K8sModuleOptions | Promise<K8sModuleOptions>;
    inject?: unknown[];
    imports?: unknown[];
  }): DynamicModule {
    return {
      module: KubernetesModule,
      imports: (asyncOptions.imports as DynamicModule['imports']) ?? [],
      providers: [
        {
          provide: K8S_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: (asyncOptions.inject as never[]) ?? [],
        },
        ...PROVIDERS,
      ],
      exports: PROVIDERS,
      global: true,
    };
  }
}
