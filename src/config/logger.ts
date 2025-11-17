/**
 * Simple logger utility for the application
 * Uses console with color coding for different log levels
 */

enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = this.getTimestamp();
    const argsStr = args.length > 0 ? ' ' + args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';

    return `[${timestamp}] [${level}] ${message}${argsStr}`;
  }

  info(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage(LogLevel.INFO, message, ...args);
    console.log(`${colors.green}${formatted}${colors.reset}`);
  }

  warn(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage(LogLevel.WARN, message, ...args);
    console.warn(`${colors.yellow}${formatted}${colors.reset}`);
  }

  error(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage(LogLevel.ERROR, message, ...args);
    console.error(`${colors.red}${formatted}${colors.reset}`);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, ...args);
      console.log(`${colors.cyan}${formatted}${colors.reset}`);
    }
  }

  // Alias methods for compatibility
  log = this.info;
}

// Create and export singleton instance
const logger = new Logger();

export default logger;
