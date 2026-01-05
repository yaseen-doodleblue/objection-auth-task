import { Controller, Post, Body, UsePipes, HttpCode } from '@nestjs/common';
import { Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { SignUpSchema } from './dto/signup.schema';
import { SignInSchema } from './dto/signin.schema'; 
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { AddEmployeeSchema } from './dto/add-employee.schema';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UsePipes(new JoiValidationPipe(SignUpSchema))
  async signUp(@Body() body: any) {
    return this.authService.signUp(body);
  }

  @Post('signin')
  @HttpCode(200) // Standard for login is 200 OK
  @UsePipes(new JoiValidationPipe(SignInSchema))
  async signIn(@Body() body: any) {
    return this.authService.signIn(body);
  }

  // Get Full Data from Database
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req) {
    // 1. Take the ID from the token
    const userId = req.user.userId;

    // 2. Ask the Service to find the full details in the Database
    return this.authService.getProfile(userId);
  }

  // Add employee ENDPOINT
  @Post('add-employee')
  @UseGuards(AuthGuard('jwt'), RolesGuard) 
  @Roles('Admin') 
  @UsePipes(new JoiValidationPipe(AddEmployeeSchema))
  async addEmployee(@Body() body: any) {
    return this.authService.addEmployee(body);
  }


}

