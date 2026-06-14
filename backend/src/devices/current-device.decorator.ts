import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceRequest } from './device-auth.guard';

export const CurrentDevice = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<DeviceRequest>().device,
);
