import { spawn } from "child_process";

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SpawnOptions {
  command: string[];
  stdin?: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  cwd?: string;
}

export interface StreamingSpawnOptions extends SpawnOptions {
  onLine: (line: string) => void;
}

export function spawnProcess(opts: SpawnOptions): Promise<SpawnResult> {
  const { command, stdin, timeoutMs = 300_000, env, cwd } = opts;
  const [cmd, ...args] = command;

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      cwd,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: code ?? 1,
      });
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

export function spawnStreamingProcess(opts: StreamingSpawnOptions): Promise<SpawnResult> {
  const { command, stdin, timeoutMs = 300_000, env, cwd, onLine } = opts;
  const [cmd, ...args] = command;

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      cwd,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let lineBuffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      lineBuffer += chunk.toString("utf-8");
      const lines = lineBuffer.split("\n");
      // Keep the last (potentially incomplete) segment in the buffer
      lineBuffer = lines.pop()!;
      for (const line of lines) {
        if (line.length > 0) {
          onLine(line);
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      // Emit any remaining data in the buffer
      if (lineBuffer.length > 0) {
        onLine(lineBuffer);
      }
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: code ?? 1,
      });
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}
