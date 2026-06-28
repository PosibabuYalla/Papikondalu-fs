import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'GOOGLE_CLIENT_ID_NOT_SET';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'GOOGLE_CLIENT_SECRET_NOT_SET';
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/api/v1/auth/google/callback';

    if (clientID === 'GOOGLE_CLIENT_ID_NOT_SET') {
      new Logger(GoogleStrategy.name).warn(
        'GOOGLE_CLIENT_ID is not set — Google OAuth will not work. Add it to .env to enable it.',
      );
    }

    super({ clientID, clientSecret, callbackURL, scope: ['email', 'profile'] });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const { name, emails, photos } = profile;

    if (!emails?.length) {
      return done(new Error('No email returned from Google'), undefined);
    }

    const user = {
      googleId: profile.id,
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`.trim(),
      avatar: photos?.[0]?.value ?? null,
    };

    done(null, user);
  }
}
