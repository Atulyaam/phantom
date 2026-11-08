/**
 * Phantom Audit — Privacy-Safe Logging Utility (PRIV-001)
 *
 * Enforces strict console and diagnostic log sanitization across the extension.
 * Guarantees that sensitive URLs, credentials, session tokens, authorization keys,
 * passwords, form values, and raw DOM excerpts are never logged to browser
 * developer consoles in plaintext.
 *
 * In production environments, debug logs are suppressed completely.
 */

import { isSensitiveQueryParam, SENSITIVE_QUERY_KEYS } from './storage';

export interface LogSafeOptions {
  code?: string;
  debug?: boolean;
}

export const MAX_LOG_LENGTH = 2000;

/**
 * Checks whether an object property key or query parameter name indicates sensitive data.
 * Resilient against mixed case, zero-width spaces, and URL encoding.
 */
export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  let lower = key.trim().toLowerCase();
  lower = lower.replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (SENSITIVE_QUERY_KEYS.has(lower) || isSensitiveQueryParam(lower)) {
    return true;
  }
  return (
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('credential') ||
    lower.includes('auth') ||
    lower.includes('apikey') ||
    lower.includes('api_key') ||
    lower.endsWith('_key') ||
    lower.startsWith('key_') ||
    lower === 'pwd' ||
    lower === 'pass' ||
    lower === 'key' ||
    lower === 'jwt' ||
    lower === 'cookie' ||
    lower === 'session'
  );
}

/**
 * Checks whether the runtime environment is production mode.
 */
function isProductionEnvironment(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return true;
  }
  // Vite / WXT environment check
  try {
    if (
      typeof import.meta !== 'undefined' &&
      (import.meta.env?.PROD || import.meta.env?.MODE === 'production')
    ) {
      return true;
    }
  } catch {
    // Ignore meta resolution errors in non-ESM environments
  }
  return false;
}

/**
 * Recursively sanitizes plain objects so sensitive keys are replaced with [REDACTED].
 * Employs a WeakSet to deterministically disarm circular references.
 */
function sanitizeObjectProperties(
  obj: Record<string, unknown>,
  depth = 0,
  seen = new WeakSet<object>()
): Record<string, unknown> {
  if (depth > 4) return { error: '[DEPTH_EXCEEDED]' };
  if (seen.has(obj)) return { circular: '[CIRCULAR_REFERENCE]' };
  seen.add(obj);

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeObjectProperties(
        val as Record<string, unknown>,
        depth + 1,
        seen
      );
    } else if (Array.isArray(val)) {
      sanitized[key] = val.map((item) =>
        item && typeof item === 'object'
          ? sanitizeObjectProperties(item as Record<string, unknown>, depth + 1, seen)
          : typeof item === 'string'
            ? sanitizeText(item)
            : item
      );
    } else if (typeof val === 'string') {
      sanitized[key] = sanitizeText(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a raw text string:
 * 1. Bounds length to prevent console DoS (MAX_LOG_LENGTH).
 * 2. Neutralizes CRLF / newlines and Unicode line separators to prevent log forging.
 * 3. Redacts credentials across all URI schemes (https, wss, blob, etc.).
 * 4. Redacts sensitive query parameters across single, double, and mixed-case encodings.
 * 5. Redacts Bearer and Basic authorization tokens.
 * 6. Redacts DOM form password values and sensitive data-* attributes.
 * 7. Redacts standalone credential and key-value assignments.
 */
function sanitizeText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;

  // Bounded length protection against console flooding
  if (text.length > MAX_LOG_LENGTH) {
    text = text.slice(0, MAX_LOG_LENGTH) + '... [TRUNCATED]';
  }

  // Neutralize CRLF and Unicode line terminators to eliminate log injection / forging
  text = text.replace(/[\r\n\u2028\u2029]+/g, ' ');

  // 1. Redact URL credentials across all schemes (http, https, wss, ws, ftp, blob, etc.)
  text = text.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/gi,
    (_match, scheme) => `${scheme}[REDACTED]@`
  );

  // 2. Redact sensitive query parameters in URLs, standalone query strings, or hash fragments
  // Utilizes isSensitiveQueryParam to decode single, double, and mixed-case percent-encodings
  text = text.replace(/([?&#])([^=&\s#]+)=([^&\s#]*)/gi, (match, prefix, rawKey) => {
    if (isSensitiveQueryParam(rawKey) || isSensitiveKey(rawKey)) {
      return `${prefix}${rawKey}=[REDACTED]`;
    }
    return match;
  });

  // 3. Redact Bearer and Basic authentication headers
  text = text.replace(/\bBearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
  text = text.replace(/\bBasic\s+[a-zA-Z0-9+/=]+={0,2}/gi, 'Basic [REDACTED]');

  // 4. Redact DOM form password values
  text = text.replace(
    /(type=['"]?password['"]?[^>]*\bvalue=)(['"]?)[^"'>]*\2/gi,
    '$1"[PASSWORD_REDACTED]"'
  );
  text = text.replace(
    /(\bvalue=)(['"]?)[^"'>]*\2([^>]*type=['"]?password['"]?)/gi,
    '$1"[PASSWORD_REDACTED]"$3'
  );

  // 5. Redact generic input value="..." in HTML fragments (excluding password inputs)
  text = text.replace(
    /(<input\b(?![^>]*\btype=['"]?password['"]?)[^>]*\bvalue=)(['"]?)[^"'>]*\2/gi,
    '$1"[REDACTED]"'
  );

  // 6. Redact sensitive data-* attributes
  text = text.replace(
    /(\bdata-[a-zA-Z0-9_-]*(?:token|secret|auth|key|pass|cred)[a-zA-Z0-9_-]*=)(['"]?)[^"'\s>]*\2/gi,
    '$1"[REDACTED]"'
  );

  // 7. Redact key-value assignments (e.g. password="secret", apiKey: "xyz")
  text = text.replace(
    /(?<![\w-])([a-zA-Z0-9_]*(?:token|secret|password|passwd|apiKey|api_key|access_token|refresh_token|credential|credentials|auth|jwt)|pwd|pass)\s*[:=]\s*(['"]?)([^"',\s;{}&?]+)\2/gi,
    (_match, key) => `${key}=[REDACTED]`
  );

  return text;
}

/**
 * Extracts a safe, privacy-scrubbed message from an Error, string, or arbitrary object.
 * Guarantees zero leakage of credentials, tokens, passwords, or raw object hierarchies.
 */
export function sanitizeLogMessage(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  let code: string | undefined;
  let rawText = '';

  if (input instanceof Error) {
    rawText = input.message || input.name || 'Unknown error';
    if ('code' in input && typeof (input as { code: unknown }).code === 'string') {
      code = (input as { code: string }).code;
    } else if (input.name && input.name !== 'Error') {
      // Use custom error name as diagnostic code if applicable
      code = input.name;
    }
  } else if (typeof input === 'string') {
    rawText = input;
  } else if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const keys = Object.keys(obj);
    const hasOtherProps = keys.some(
      (k) => isSensitiveKey(k) || (k !== 'message' && k !== 'code')
    );
    if (typeof obj.message === 'string' && !hasOtherProps) {
      rawText = obj.message;
      if (typeof obj.code === 'string') {
        code = obj.code;
      }
    } else {
      // Sanitize object properties and safely stringify
      try {
        const sanitizedObj = sanitizeObjectProperties(obj);
        rawText = JSON.stringify(sanitizedObj);
      } catch {
        rawText = '[Unserializable Object]';
      }
    }
  } else {
    rawText = String(input);
  }

  const sanitized = sanitizeText(rawText);
  if (code && !sanitized.includes(code)) {
    return `[${code}] ${sanitized}`;
  }
  return sanitized;
}

/**
 * Logs a sanitized warning to console.warn without exposing raw Error objects or secrets.
 */
export function logSafeWarn(
  context: string,
  errorOrMessage?: unknown,
  options?: LogSafeOptions
): void {
  const codePrefix = options?.code ? ` [${options.code}]` : '';
  const sanitized =
    errorOrMessage !== undefined ? sanitizeLogMessage(errorOrMessage) : '';
  const fullMessage = sanitized ? ` ${sanitized}` : '';
  console.warn(`[PhantomAudit:${context}]${codePrefix}${fullMessage}`);
}

/**
 * Alias for logSafeWarn for interface consistency across execution plan and components.
 */
export const logSafeWarning = logSafeWarn;

/**
 * Logs a sanitized error to console.error without exposing raw Error objects or secrets.
 */
export function logSafeError(
  context: string,
  errorOrMessage?: unknown,
  options?: LogSafeOptions
): void {
  const codePrefix = options?.code ? ` [${options.code}]` : '';
  const sanitized =
    errorOrMessage !== undefined ? sanitizeLogMessage(errorOrMessage) : '';
  const fullMessage = sanitized ? ` ${sanitized}` : '';
  console.error(`[PhantomAudit:${context}]${codePrefix}${fullMessage}`);
}

/**
 * Logs a sanitized informational message to console.info.
 */
export function logSafeInfo(context: string, message?: unknown): void {
  if (isProductionEnvironment()) {
    // Suppress general diagnostic logs in production
    return;
  }
  const sanitized = message !== undefined ? sanitizeLogMessage(message) : '';
  console.info(`[PhantomAudit:${context}] ${sanitized}`);
}

/**
 * Logs a sanitized debug message to console.debug.
 * Completely suppressed in production environments.
 */
export function logSafeDebug(context: string, message?: unknown): void {
  if (isProductionEnvironment()) {
    return;
  }
  const sanitized = message !== undefined ? sanitizeLogMessage(message) : '';
  // eslint-disable-next-line no-console
  console.debug(`[PhantomAudit:${context}] ${sanitized}`);
}
