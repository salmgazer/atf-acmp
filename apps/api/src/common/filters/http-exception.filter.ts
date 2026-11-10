import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errors: any[] | undefined;
    let retryAfterSeconds: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as Record<string, any>;
        message = responseObj.message || message;
        errors = responseObj.errors;
        if (status === HttpStatus.TOO_MANY_REQUESTS && Number.isInteger(responseObj.retryAfterSeconds) && responseObj.retryAfterSeconds > 0) retryAfterSeconds = responseObj.retryAfterSeconds;
      }
    } else if (exception instanceof QueryFailedError && (exception.driverError as any)?.code === "23514") {
      status = HttpStatus.BAD_REQUEST;
      message = (exception.driverError as any).message || "Group assignment is not valid";
    } else if (exception instanceof QueryFailedError && ["23505", "P0001", "40001", "40P01"].includes((exception.driverError as any)?.code)) {
      status = HttpStatus.CONFLICT;
      message = "This action conflicts with the current state. Refresh and try again.";
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack
      );
    }

    // Don't leak internal details in production
    if (process.env.NODE_ENV === "production" && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = "An unexpected error occurred";
    }

    const errorResponse = {
      statusCode: status,
      message,
      ...(errors && { errors }),
      ...(retryAfterSeconds && { retryAfterSeconds }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
