import type { Request, Response, NextFunction } from 'express';

interface PendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const REQUEST_TIMEOUT_MS = 30000;
const CLEANUP_INTERVAL_MS = 60000;

function generateRequestKey(req: Request): string {
  const method = req.method;
  const path = req.path;
  const userId = (req.user as Record<string, unknown>)?.userId ?? 'anonymous';
  const body = method === 'GET' ? '' : JSON.stringify(req.body ?? {});
  return `${method}:${path}:${userId}:${body}`;
}

export function requestDeduplication(req: Request, res: Response, next: NextFunction): void {
  // Only deduplicate mutating operations
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const key = generateRequestKey(req);
  const now = Date.now();
  const pending = pendingRequests.get(key);

  if (pending) {
    const age = now - pending.timestamp;
    if (age < REQUEST_TIMEOUT_MS) {
      res.status(409).json({
        success: false,
        message: 'Solicitud duplicada detectada. Esperando respuesta del primer envío.',
      });
      return;
    }
    pendingRequests.delete(key);
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const cleanup = () => {
    pendingRequests.delete(key);
  };

  const wrappedJson = (data: unknown) => {
    cleanup();
    return originalJson(data);
  };

  const wrappedSend = (data: unknown) => {
    cleanup();
    return originalSend(data);
  };

  res.json = wrappedJson as unknown as typeof res.json;
  res.send = wrappedSend as unknown as typeof res.send;

  res.on('finish', cleanup);
  res.on('close', cleanup);

  const responsePromise = new Promise((resolve) => {
    const originalEnd = res.end.bind(res);
    res.end = (function (...args: unknown[]) {
      resolve(null);
      cleanup();
      return originalEnd(...(args as []));
    }) as unknown as typeof res.end;
  });

  pendingRequests.set(key, {
    promise: responsePromise,
    timestamp: now,
  });

  next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, pending] of pendingRequests.entries()) {
    if (now - pending.timestamp > REQUEST_TIMEOUT_MS) {
      pendingRequests.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
