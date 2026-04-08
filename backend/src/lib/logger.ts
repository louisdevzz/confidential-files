type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFormat = 'pretty' | 'json';

type LogMeta = Record<string, unknown>;

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const parseLogLevel = (value: string | undefined): LogLevel => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
};

const parseLogFormat = (value: string | undefined): LogFormat => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'pretty' || normalized === 'json') {
    return normalized;
  }
  return process.stdout?.isTTY ? 'pretty' : 'json';
};

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
} as const;

const levelStyle: Record<LogLevel, { label: string; color: string }> = {
  debug: { label: 'DEBUG', color: ANSI.cyan },
  info: { label: 'INFO ', color: ANSI.green },
  warn: { label: 'WARN ', color: ANSI.yellow },
  error: { label: 'ERROR', color: ANSI.red },
};

const SCOPE_COLORS = [ANSI.magenta, ANSI.blue, ANSI.cyan, ANSI.green, ANSI.yellow];

const CURRENT_FORMAT = parseLogFormat(process.env.LOG_FORMAT);

const COLOR_ENABLED = (() => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout?.isTTY);
})();

const CURRENT_LEVEL = parseLogLevel(process.env.LOG_LEVEL);

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[CURRENT_LEVEL];
};

const serializeError = (err: unknown): LogMeta => {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
    };
  }
  return { errorValue: String(err) };
};

const colorize = (text: string, ...styles: string[]): string => {
  if (!COLOR_ENABLED || styles.length === 0) return text;
  return `${styles.join('')}${text}${ANSI.reset}`;
};

const truncate = (value: string, maxLength = 220): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const scopeColor = (scope: string): string => {
  let hash = 0;
  for (let index = 0; index < scope.length; index += 1) {
    hash = (hash * 31 + scope.charCodeAt(index)) >>> 0;
  }
  return SCOPE_COLORS[hash % SCOPE_COLORS.length];
};

const formatMetaValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    const singleLine = value.replace(/\s+/g, ' ').trim();
    return `"${truncate(singleLine)}"`;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  try {
    return truncate(JSON.stringify(value));
  } catch {
    return truncate(String(value));
  }
};

const formatPrettyLog = (params: {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
  meta?: LogMeta;
}): string => {
  const { ts, level, scope, message, meta } = params;
  const style = levelStyle[level];

  const firstLine = [
    colorize(ts, ANSI.dim),
    colorize(style.label, ANSI.bold, style.color),
    colorize(`[${scope}]`, ANSI.bold, scopeColor(scope)),
    message,
  ].join(' ');

  const entries = Object.entries(meta ?? {});
  if (entries.length === 0) return firstLine;

  const stackEntry = entries.find(([key]) => key === 'errorStack');
  const normalEntries = entries.filter(([key]) => key !== 'errorStack');

  const lines: string[] = [firstLine];

  if (normalEntries.length > 0) {
    const metaText = normalEntries
      .map(([key, value]) => {
        const coloredKey = colorize(key, ANSI.cyan);
        const coloredValue = colorize(formatMetaValue(value), ANSI.bold);
        return `${coloredKey}=${coloredValue}`;
      })
      .join('  ');

    lines.push(`${colorize('  meta', ANSI.dim)} ${metaText}`);
  }

  const rawStack = typeof stackEntry?.[1] === 'string' ? stackEntry[1] : null;
  if (rawStack) {
    lines.push(colorize('  stack', ANSI.dim));
    const stackLines = rawStack.split('\n').slice(0, 8);
    for (const line of stackLines) {
      lines.push(colorize(`    ${line}`, ANSI.dim));
    }
    if (rawStack.split('\n').length > stackLines.length) {
      lines.push(colorize('    ...', ANSI.dim));
    }
  }

  return lines.join('\n');
};

class Logger {
  constructor(private readonly scope: string) {}

  child(nextScope: string): Logger {
    return new Logger(`${this.scope}:${nextScope}`);
  }

  debug(message: string, meta?: LogMeta): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: LogMeta): void {
    if (!shouldLog(level)) return;

    const ts = new Date().toISOString();

    if (CURRENT_FORMAT === 'pretty') {
      const formatted = formatPrettyLog({ ts, level, scope: this.scope, message, meta });

      if (level === 'error') {
        console.error(formatted);
        return;
      }

      if (level === 'warn') {
        console.warn(formatted);
        return;
      }

      console.info(formatted);
      return;
    }

    const payload: LogMeta = {
      ts,
      level,
      scope: this.scope,
      message,
      ...(meta ?? {}),
    };

    if (level === 'error') {
      console.error(JSON.stringify(payload));
      return;
    }

    if (level === 'warn') {
      console.warn(JSON.stringify(payload));
      return;
    }

    console.info(JSON.stringify(payload));
  }
}

export const createLogger = (scope: string): Logger => new Logger(scope);

export const withErrorMeta = (err: unknown, baseMeta?: LogMeta): LogMeta => {
  return {
    ...(baseMeta ?? {}),
    ...serializeError(err),
  };
};