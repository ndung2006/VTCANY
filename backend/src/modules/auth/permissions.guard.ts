import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { hasPermission } from './users.store';

@Injectable()
export class PermissionsGuard extends JwtAuthGuard {
  constructor(jwt: JwtService, private reflector: Reflector) {
    super(jwt);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await super.canActivate(ctx);
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.role;
    if (!role || !required.every((p) => hasPermission(role, p))) {
      throw new ForbiddenException('missing permission');
    }
    return true;
  }
}
