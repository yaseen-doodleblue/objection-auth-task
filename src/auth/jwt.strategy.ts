import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // 1. Where to find the token? (In the 'Authorization: Bearer <token>' header)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // 2. Allow expired tokens? No.
      ignoreExpiration: false,
      
      // 3. Use the same secret key we used to sign it
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // This runs if the token is valid.
  // It attaches this data to 'req.user' so we can use it in the Controller.
  async validate(payload: any) {
    return { userId: payload.userId, email: payload.email, role: payload.role };
  }
}