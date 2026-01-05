import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Get the required roles for this route (e.g., ['Admin'])
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, anyone can access
    if (!requiredRoles) {
      return true;
    }

    // 2. Get the user from the request (attached by JwtStrategy)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 3. Check if the user has the required role
    if (!user || !requiredRoles.includes(user.role)) {
      throw new UnauthorizedException('You do not have permission (Admin only)');
    }

    return true;
  }
}