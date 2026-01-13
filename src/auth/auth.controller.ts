// 1. ADDED MISSING IMPORTS: Delete, Put, ParseIntPipe
import { Controller, Post, Body, UsePipes, HttpCode, Get, UseGuards, Request, Query, Res, Param, Delete, Put, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { SignUpSchema } from './dto/signup.schema';
import { SignInSchema } from './dto/signin.schema'; 
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { AuthGuard } from '@nestjs/passport';
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

  // 2. SIGN IN
  @Post('signin')
  @HttpCode(200)
  @UsePipes(new JoiValidationPipe(SignInSchema))
  async signIn(@Body() body: any) {
    return this.authService.signIn(body);
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
  @Roles('Admin', 'Manager')  
  @UsePipes(new JoiValidationPipe(AddEmployeeSchema))
  async addEmployee(@Body() body: any) {
    return this.authService.addEmployee(body);
  }

  // 5. GET ALL USERS
  @Get('users')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 
  @Roles('Admin', 'Manager') 
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('role') role: string = '',
  ) {
    return this.authService.getAllUsers(Number(page), Number(limit), search, role);
  }

  // 6. DELETE USER
  @Delete('users/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.authService.deleteUser(id);
  }

  // 7. UPDATE USER (Secured for Self-Update)
  @Put('users/:id')
  @UseGuards(AuthGuard('jwt')) 
  async updateUser(
    @Param('id', ParseIntPipe) id: number, 
    @Body() body: any,
    @Request() req 
  ) {
    // SECURITY CHECK
    const requesterId = req.user.userId;
    const requesterRole = req.user.role;
    const isAdminOrManager = ['Admin', 'Manager'].includes(requesterRole);
    const isOwner = Number(requesterId) === Number(id);

    if (!isAdminOrManager && !isOwner) {
        throw new ForbiddenException('You can only update your own profile.');
    }

    return this.authService.updateUser(id, body);
  }

  // 8. EXPORT CSV
  @Get('export/csv')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin', 'Manager')
  async exportUsersCsv(@Res() res: Response) {
    const csvData = await this.authService.generateCsvExport();
    
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="employees.csv"',
    });

    res.send(csvData);
  }

  // 9. EXPORT PDF 
  @Get('export/pdf/:id')
  @UseGuards(AuthGuard('jwt'))
  async exportUserProfilePdf(
    @Param('id') id: number, 
    @Res() res: Response,
    @Request() req // Needed to check WHO is asking
  ) {
    // SECURITY CHECK: Only allow if Admin/Manager OR if it's your own ID
    const requesterId = req.user.userId;
    const requesterRole = req.user.role;
    
    const isAdminOrManager = ['Admin', 'Manager'].includes(requesterRole);
    const isOwner = Number(requesterId) === Number(id);

    if (!isAdminOrManager && !isOwner) {
        return res.status(403).json({ message: 'Forbidden: You can only download your own profile.' });
    }

    const buffer = await this.authService.generatePdfExport(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="employee_${id}_profile.pdf"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}