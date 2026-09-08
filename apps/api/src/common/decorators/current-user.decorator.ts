import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Get the current authenticated user from the request
 */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  if (data) {
    return user?.[data];
  }

  return user;
});
