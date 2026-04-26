import { Log } from '@kubernetes/client-node';
import { PassThrough } from 'node:stream';

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

/** Read all current logs of a pod (no follow). */
export async function readPodLogs(
  log: Log,
  options: LogReadOptions,
  namespace: string,
): Promise<string> {
  const stream = new PassThrough();
  let buffer = '';
  stream.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
  });

  return new Promise<string>((resolve, reject) => {
    stream.on('end', () => resolve(buffer));
    stream.on('error', reject);

    log
      .log(
        namespace,
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
 * Stream pod logs, calling `onLine` once per newline-delimited line.
 * Returns a function that stops the stream when called.
 */
export async function streamPodLogs(
  log: Log,
  options: LogStreamOptions,
  namespace: string,
): Promise<() => void> {
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

  const req: any = await log.log(
    namespace,
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
