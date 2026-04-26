import { Exec } from '@kubernetes/client-node';
import { PassThrough, Readable } from 'node:stream';

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

/**
 * Run a command inside a pod via the Kubernetes WebSocket exec API and
 * resolve once it completes, returning captured stdout/stderr and the
 * exit code.
 */
export async function execInPod(
  exec: Exec,
  options: ExecOptions,
  namespace: string,
): Promise<ExecResult> {
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
    exec
      .exec(
        namespace,
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
