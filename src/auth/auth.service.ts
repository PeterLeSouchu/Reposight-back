import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateGitHubUser(profile: any) {
    // Ici, vous pouvez ajouter la logique de stockage en BDD si nécessaire
    return {
      id: profile.id,
      githubId: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      photos: profile.photos,
    };
  }

  async generateJWT(user: any) {
    const payload = {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
    };
    return this.jwtService.sign(payload);
  }
}
