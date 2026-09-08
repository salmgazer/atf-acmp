import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";

/**
 * Interceptor to sanitize potentially dangerous input from request body
 */
@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body && typeof request.body === "object") {
      request.body = this.sanitizeObject(request.body);
    }

    return next.handle();
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === "object") {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip prototype pollution attempts
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          continue;
        }
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    if (typeof obj === "string") {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    // Basic HTML entity encoding for XSS prevention
    // Note: For rich text fields that need HTML, use a dedicated sanitizer like DOMPurify
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
}

/**
 * Decorator to mark fields that should allow HTML (for rich text editors)
 * These fields should be sanitized separately with DOMPurify or similar
 */
export const ALLOW_HTML_KEY = "allow_html";
export function AllowHtml() {
  return function (target: any, propertyKey: string) {
    const allowedFields = Reflect.getMetadata(ALLOW_HTML_KEY, target) || [];
    allowedFields.push(propertyKey);
    Reflect.defineMetadata(ALLOW_HTML_KEY, allowedFields, target);
  };
}
