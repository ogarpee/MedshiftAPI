import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AccountStatus, AuthResponse, AuthTokenPayload } from "@medshift/shared-types";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { PasswordService } from "./password.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly notificationService: NotificationService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.users.exists({ email });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const user = await this.users.create({
      email,
      passwordHash: await this.passwordService.hash(dto.password),
      role: dto.role,
      status: AccountStatus.Pending
    });

    await this.notificationService.sendWelcomeEmail(user.email, user.role);

    return this.toAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findOne({ email: dto.email.toLowerCase().trim() }).exec();

    if (!user || !(await this.passwordService.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.toAuthResponse(user);
  }

  private async toAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      }
    };
  }
}
