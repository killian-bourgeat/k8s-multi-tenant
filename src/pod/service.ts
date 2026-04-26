import { Injectable } from '@nestjs/common';
import { Exec, Log } from '@kubernetes/client-node';
import { K8sCoreClient } from '../core/client.js';
import { execInPod, type ExecOptions, type ExecResult } from './exec.js';
import {
  readPodLogs,
  streamPodLogs,
  type LogReadOptions,
  type LogStreamOptions,
} from './logs.js';

/**
 * Operations on Pods that go beyond CRUD: `kubectl exec`, log reading,
 * and log streaming. Useful for SaaS that need to bootstrap state inside
 * tenant pods (run migrations, init replica sets, seed data) or expose
 * live container logs to tenants.
 *
 * The actual implementations live in `exec.ts` and `logs.ts`. This service
 * is a thin facade that handles namespace resolution and lazy-init of the
 * underlying `Exec` / `Log` clients.
 */
@Injectable()
export class K8sPodService {
  private _exec?: Exec;
  private _log?: Log;

  constructor(private readonly k8s: K8sCoreClient) {}

  private get exec(): Exec {
    if (!this._exec) this._exec = new Exec(this.k8s.kubeConfig);
    return this._exec;
  }

  private get log(): Log {
    if (!this._log) this._log = new Log(this.k8s.kubeConfig);
    return this._log;
  }

  execCommand(options: ExecOptions): Promise<ExecResult> {
    return execInPod(this.exec, options, this.k8s.resolveNamespace(options.namespace));
  }

  readLogs(options: LogReadOptions): Promise<string> {
    return readPodLogs(this.log, options, this.k8s.resolveNamespace(options.namespace));
  }

  streamLogs(options: LogStreamOptions): Promise<() => void> {
    return streamPodLogs(this.log, options, this.k8s.resolveNamespace(options.namespace));
  }
}
