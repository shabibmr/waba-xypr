export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface LogContext {
  operation?: string;
  wa_id?: string;
  wamid?: string;
  mapping_id?: string;
  conversation_id?: string | null;
  duration_ms?: number;
  [key: string]: any;
}

class Logger {
  private minLevel: LogLevel = LogLevel.DEBUG;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.minLevel = envLevel;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'state-manager',
      message,
      ...context
    };

    const output = JSON.stringify(logEntry);
    console.log(output);
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context);
  }

  critical(message: string, context?: LogContext) {
    this.log(LogLevel.CRITICAL, message, context);
  }
}

export const logger = new Logger();
export default logger;
