import api from './api';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogCategory = 'push_notification' | 'network' | 'auth' | 'app' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  error?: any;
}

class LoggerService {
  private static instance: LoggerService;
  private logQueue: LogEntry[] = [];
  private isProcessingQueue = false;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  private constructor() {
    // Initialize the service
    this.startQueueProcessor();
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private async processLogQueue() {
    if (this.isProcessingQueue || this.logQueue.length === 0) return;

    this.isProcessingQueue = true;
    const batch = this.logQueue.splice(0, 10); // Process 10 logs at a time

    let retryCount = 0;
    while (retryCount < this.MAX_RETRY_ATTEMPTS) {
        try {
            await api.post('/debug/log', { logs: batch });
            break; // Success - exit retry loop
        } catch (error) {
            retryCount++;
            console.error(`Failed to send logs to server (attempt ${retryCount}/${this.MAX_RETRY_ATTEMPTS}):`, error);
            
            if (retryCount === this.MAX_RETRY_ATTEMPTS) {
                // All retries failed, put logs back in queue
                this.logQueue.unshift(...batch);
                break;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
    }

    this.isProcessingQueue = false;
    // Continue processing if there are more logs
    if (this.logQueue.length > 0) {
        setTimeout(() => this.processLogQueue(), 100);
    }
  }

  private startQueueProcessor() {
    setInterval(() => this.processLogQueue(), 5000); // Process queue every 5 seconds
  }

  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any,
    error?: any
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      ...(error && { error: this.formatError(error) })
    };
  }

  private formatError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  }

  // Push Notification specific logging
  async logPushNotification(message: string, details?: any) {
    const entry = this.createLogEntry('info', 'push_notification', message, details);
    this.logQueue.push(entry);
    console.log(`[Push Notification] ${message}`, details);
  }

  async logPushNotificationError(message: string, error: any, details?: any) {
    const entry = this.createLogEntry('error', 'push_notification', message, details, error);
    this.logQueue.push(entry);
    console.error(`[Push Notification Error] ${message}`, error, details);
  }

  // General logging methods
  async debug(category: LogCategory, message: string, details?: any) {
    const entry = this.createLogEntry('debug', category, message, details);
    this.logQueue.push(entry);
    console.debug(`[${category}] ${message}`, details);
  }

  async info(category: LogCategory, message: string, details?: any) {
    const entry = this.createLogEntry('info', category, message, details);
    this.logQueue.push(entry);
    console.info(`[${category}] ${message}`, details);
  }

  async warn(category: LogCategory, message: string, details?: any) {
    const entry = this.createLogEntry('warn', category, message, details);
    this.logQueue.push(entry);
    console.warn(`[${category}] ${message}`, details);
  }

  async error(category: LogCategory, message: string, error: any, details?: any) {
    const entry = this.createLogEntry('error', category, message, details, error);
    this.logQueue.push(entry);
    console.error(`[${category}] ${message}`, error, details);
  }
}

export const loggerService = LoggerService.getInstance();
export default loggerService; 