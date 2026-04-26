import { Injectable, Logger } from '@nestjs/common';
import { Exec, Log } from '@kubernetes/client-node';
import { PassThrough, Readable } from 'node:stream';
import { K8sCoreClient } from './k8s-core.client.js';

export interface ExecOptions {
  pod: string;
  namespace?: string;
  /** Container name. Required when the pod has multiple containers. */
  container?: string;
  /** Command and arguments. Strings are wrapped as `['/bin/sh', '-c', cmd]`. */
  command: string | string[];
  /** Optional stdin to pipe into the command. */
  stdin?: string;
  /** Allocate a TTY. @default false */
  tty?: boolean;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  /** Exit code reported by the API server. `0` on success. */
  exitCode: number;
  success: boolean;
}

export interface LogReadOptions {
  pod: string;
  namespace?: string;
  container?: string;
  /** Show only the last N lines. */
  tailLines?: number;
  /** Only return logs newer than N seconds. */
  sinceSeconds?: number;
  /** Prefix each line with a timestamp. */
  timestamps?: boolean;
  /** Read logs from a previously terminated container instance. */
  previous?: boolean;
}

export interface LogStreamOptions extends LogReadOptions {
  /** Called once per log line (newline-delimited). */
  onLine: (line: string) => void;
  /** Called if the underlying stream errors. */
  onError?: (err: Error) => void;
  /** Called when the server closes the stream. */
  onEnd?: () => void;
}

/**
 * Operations on Pods that are not just CRUD: `kubectl exec`, log reading,
 * and log streaming. Useful for SaaS that need to bootstrap state inside
 * tenant pods (run migrations, init replica sets, seed data) or expose
 * live container logs to tenants.
 */
@Injectable()
export class K8sPodService {
  private readonly logger = new Logger(K8sPodService.name);
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

  /**
   * Run a command inside a pod, similar to `kubectl exec`.
   *
   * Captures stdout / stderr and waits for the command to complete. Use this
   * to bootstrap state after pod creation — e.g. initialize a MongoDB
   * replica set, run a one-off migration, seed a tenant's database.
   *
   * @example
   * ```ts
   * const result = await pods.execCommand({
   *   pod: 'mongo-0',
   *   namespace: 'tenant-acme',
   *   command: ['mongosh', '--eval', 'rs.initiate(...)'],
   * });
   * if (!result.success) throw new Error(result.stderr);
   * ```
   */
  async execCommand(options: ExecOptions): Promise<ExecResult> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const command = Array.isArray(options.command)
      ? options.command
      : ['/bin/sh', '-c', options.command];

    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    let stdout = '';
    let stderr = '';
    stdoutStream.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    stderrStream.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const stdinStream = options.stdin
      ? Readable.from([Buffer.from(options.stdin, 'utf8')])
      : null;

    return new Promise<ExecResult>((resolve, reject) => {
      this.exec
        .exec(
          ns,
          options.pod,
          options.container ?? '',
          command,
          stdoutStream,
          stderrStream,
          stdinStream as any,
          options.tty ?? false,
          (status: any) => {
            const exitCode =
              status?.details?.causes?.find((c: any) => c.reason === 'ExitCode')
                ?.message ?? (status?.status === 'Success' ? '0' : '1');
            resolve({
              stdout,
              stderr,
              exitCode: Number.parseInt(exitCode, 10),
              success: status?.status === 'Success',
            });
          },
        )
        .catch(reject);
    });
  }

  /**
   * Read the current logs of a pod (no follow). Resolves with the full log
   * content as a string.
   */
  async readLogs(options: LogReadOptions): Promise<string> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const stream = new PassThrough();
    let buffer = '';
    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
    });

    return new Promise<string>((resolve, reject) => {
      stream.on('end', () => resolve(buffer));
      stream.on('error', reject);

      this.log
        .log(
          ns,
          options.pod,
          options.container ?? '',
          stream,
          {
            follow: false,
            tailLines: options.tailLines,
            sinceSeconds: options.sinceSeconds,
            timestamps: options.timestamps,
            previous: options.previous,
          },
        )
        .catch(reject);
    });
  }

  /**
   * Stream logs from a pod, calling `onLine` for each newline-delimited line.
   * Returns a function that, when called, stops the stream.
   *
   * @example
   * ```ts
   * const stop = await pods.streamLogs({
   *   pod: 'app-0',
   *   namespace: 'tenant-acme',
   *   tailLines: 100,
   *   onLine: (line) => websocket.send(line),
   * });
   * // later: stop();
   * ```
   */
  async streamLogs(options: LogStreamOptions): Promise<() => void> {
    const ns = this.k8s.resolveNamespace(options.namespace);
    const stream = new PassThrough();

    let leftover = '';
    stream.on('data', (chunk: Buffer) => {
      leftover += chunk.toString('utf8');
      const lines = leftover.split('\n');
      leftover = lines.pop() ?? '';
      for (const line of lines) options.onLine(line);
    });
    stream.on('error', (err) => options.onError?.(err));
    stream.on('end', () => {
      if (leftover.length > 0) options.onLine(leftover);
      options.onEnd?.();
    });

    const req: any = await this.log.log(
      ns,
      options.pod,
      options.container ?? '',
      stream,
      {
        follow: true,
        tailLines: options.tailLines,
        sinceSeconds: options.sinceSeconds,
        timestamps: options.timestamps,
        previous: options.previous,
      },
    );

    return () => {
      try {
        if (typeof req?.abort === 'function') req.abort();
        else if (typeof req?.destroy === 'function') req.destroy();
      } catch {
        /* ignore */
      }
      stream.destroy();
    };
  }
}
