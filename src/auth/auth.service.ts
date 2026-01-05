import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserModel } from '../models/user.model';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer'; 

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService, private mailerService: MailerService) {}
  
  async signUp(data: any) {
    // 1. Check if email already exists
    const existingUser = await UserModel.query().findOne({ email: data.email });
    
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    // 3. Save to Database
    const newUser = await UserModel.query().insert({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role,
      status: data.status || 'Active',
    });

    // 4. Return success response (excluding password)
    return {
      message: 'User registered successfully',
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    };
  }

  async signIn(data: any) {
    // 1. Find User
    const user = await UserModel.query().findOne({ email: data.email });
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Check Password
    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Generate Token
    const payload = { userId: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      access_token: token,
      expiresIn: '5m'
    };
  }

  async getProfile(userId: number) {
    const user = await UserModel.query().findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return everything EXCEPT the password
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status
    };
  }


  // ADD EMPLOYEE (With Email)
  async addEmployee(data: any) {
    // 1. Check if email exists
    const existingUser = await UserModel.query().findOne({ email: data.email });
    if (existingUser) throw new ConflictException('Email already exists');

    // 2. Auto-generate Password (or use provided one)
    // If no password provided, generate a random one
    const rawPassword = data.password || Math.random().toString(36).slice(-8);
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    // 3. Save to DB
    const newUser = await UserModel.query().insert({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role, // 'Manager' or 'Employee'
      status: 'Active',
    });

    // 4. Send Email
    try {
      await this.mailerService.sendMail({
        to: newUser.email,
        subject: 'Welcome to the Team! - Credentials Inside',
        template: './welcome', // The .hbs file name
        context: { // Data to pass to the template
          name: newUser.name,
          role: newUser.role,
          email: newUser.email,
          password: rawPassword, // Send the raw password so they can login
          mobile: newUser.mobile,
        },
      });
    } catch (error) {
      console.log('Email sending failed:', error);
      // We don't throw error here to avoid rolling back the user creation
    }

    return { message: 'Employee added and email sent', userId: newUser.id };
  }
}