import { Controller, Post, Body, UsePipes, HttpCode, Get, UseGuards, Request, Ip, Query } from '@nestjs/common';
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

  // 1. SIGN UP
  @Post('signup')
  @UsePipes(new JoiValidationPipe(SignUpSchema))
  async signUp(@Body() body: any) {
    return this.authService.signUp(body);
  }

  // 2. SIGN IN (Updated with IP Address)
  @Post('signin')
  @HttpCode(200)
  @UsePipes(new JoiValidationPipe(SignInSchema))
  // 👇 Capture IP address here
  async signIn(@Body() body: any, @Ip() ip: string) {
    return this.authService.signIn(body, ip);
  }

  // 3. GET PROFILE
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req) {
    const userId = req.user.userId;
    return this.authService.getProfile(userId);
  }

  // 4. ADD EMPLOYEE
  @Post('add-employee')
  @UseGuards(AuthGuard('jwt'), RolesGuard) 
  @Roles('Admin') 
  @UsePipes(new JoiValidationPipe(AddEmployeeSchema))
  async addEmployee(@Body() body: any) {
    return this.authService.addEmployee(body);
  }

  // 5. GET ALL USERS (New Endpoint for Pagination & Filtering)
  @Get('users')
  @UseGuards(AuthGuard('jwt')) // Protected Route
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('role') role: string = '',
  ) {
    // Convert page/limit to Numbers since Query params are strings
    return this.authService.getAllUsers(Number(page), Number(limit), search, role);
  }
}