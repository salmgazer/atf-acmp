import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { mergeMap } from "rxjs";
import { redactSensitive, sanitizeRichContent } from "../services/safe-content";
import { UploadService } from "../services/upload.service";

@Injectable()
export class SafeContentInterceptor implements NestInterceptor {
  constructor(private readonly uploads: UploadService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    if (req.body) req.body = sanitizeRichContent(req.body);
    return next.handle().pipe(mergeMap(value => this.uploads.signResponseUrls(redactSensitive(sanitizeRichContent(value), context.getClass().name === "AuthController"))));
  }
}
