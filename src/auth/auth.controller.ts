import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { SetPasswordDto } from '../users/dto/set-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * Consumes an invite or password-reset link. Public — the whole point is
   * that the requester isn't logged in yet.
   */
  @Post('set-password')
  async setPassword(@Body() dto: SetPasswordDto) {
    await this.usersService.setPasswordWithToken(dto.token, dto.password);
    return { success: true };
  }

  /**
   * Forgot-password entry point. Always responds the same way regardless of
   * whether the email is registered, so this can't be used to enumerate
   * accounts — the email only actually sends when a match is found.
   */
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.usersService.generatePasswordSetToken(dto.email);
    if (result) {
      await this.emailService.sendPasswordSetLink(dto.email, {
        name: result.name,
        token: result.token,
        isNewAccount: false,
      });
    }
    return { success: true };
  }
}
