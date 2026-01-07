import { Injectable, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserModel } from '../models/user.model'; // Adjust path if needed
import { LoginLogModel } from '../models/login-log.model'; // 👈 Make sure this path is correct
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer'; 

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private mailerService: MailerService) {}
  
  // 1. SIGN UP (Public Registration)
  async signUp(data: any) {
    // Check Email
    const existingUser = await UserModel.query().findOne({ email: data.email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check Mobile
    const existingMobile = await UserModel.query().findOne({ mobile: data.mobile });
    if (existingMobile) {
      throw new ConflictException('Mobile number already exists');
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    // Save
    const newUser = await UserModel.query().insert({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role,
      status: data.status || 'Active',
    });

    return {
      message: 'User registered successfully',
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    };
  }

  // 2. SIGN IN (With Locking & Logging)
  async signIn(data: any, ip: string = '127.0.0.1') {
    const user = await UserModel.query().findOne({ email: data.email });
    
    // A. User Not Found
    if (!user) {
      await this.logAttempt(null, data.email, 'Failed (User Not Found)', ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    // B. Check Lock Status
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      await this.logAttempt(user.id, user.email, 'Failed (Locked)', ip);
      throw new ForbiddenException('Account is temporarily locked. Try again in 15 mins.');
    }

    // C. Verify Password
    const isMatch = await bcrypt.compare(data.password, user.password);
    
    if (!isMatch) {
      // HANDLE FAILURE
      const newFailCount = (user.failed_attempts || 0) + 1;
      
      if (newFailCount >= 5) {
        // Lock the account
        const lockTime = new Date();
        lockTime.setMinutes(lockTime.getMinutes() + 15); // Add 15 mins

        await UserModel.query().patchAndFetchById(user.id, {
          failed_attempts: newFailCount,
          locked_until: lockTime.toISOString(),
        });

        // Send Lock Notification
        try {
            await this.mailerService.sendMail({
            to: user.email,
            subject: 'Security Alert: Account Locked',
            template: './account-locked', 
            context: { name: user.name },
            });
        } catch (e) { console.log('Email error:', e); }

        await this.logAttempt(user.id, user.email, 'Failed (Locked Triggered)', ip);
        throw new ForbiddenException('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        // Just increment counter
        await UserModel.query().patchAndFetchById(user.id, {
          failed_attempts: newFailCount,
        });
        
        await this.logAttempt(user.id, user.email, 'Failed (Wrong Password)', ip);
        throw new UnauthorizedException(`Invalid credentials. Attempts remaining: ${5 - newFailCount}`);
      }
    }

    // D. SUCCESS
    // Reset counters if they were previously bad
    if (user.failed_attempts > 0 || user.locked_until) {
      await UserModel.query().patchAndFetchById(user.id, {
        failed_attempts: 0,
        locked_until: null,
      });
      
      // Optional: Send Reactivation Email if previously locked
      // await this.mailerService.sendMail(...)
    }

    await this.logAttempt(user.id, user.email, 'Success', ip);

    // Generate Token
    const payload = { userId: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      access_token: token,
      expiresIn: '5m'
    };
  }

  // 3. GET PROFILE
  async getProfile(userId: number) {
    const user = await UserModel.query().findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status
    };
  }

  // 4. ADD EMPLOYEE (Admin Only)
  async addEmployee(data: any) {
    // Check Email
    const existingUser = await UserModel.query().findOne({ email: data.email });
    if (existingUser) throw new ConflictException('Email already exists');

    // 👇 Check Mobile (New)
    const existingMobile = await UserModel.query().findOne({ mobile: data.mobile });
    if (existingMobile) throw new ConflictException('Mobile number already exists');

    // Auto-generate Password
    const rawPassword = data.password || Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    // Save to DB
    const newUser = await UserModel.query().insert({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role, 
      status: 'Active',
    });

    // Send Welcome Email
    try {
      await this.mailerService.sendMail({
        to: newUser.email,
        subject: 'Welcome to the Team! - Credentials Inside',
        template: './welcome',
        context: {
          name: newUser.name,
          role: newUser.role,
          email: newUser.email,
          password: rawPassword,
          mobile: newUser.mobile,
        },
      });
    } catch (error) {
      console.log('Email sending failed:', error);
    }

    return { message: 'Employee added and email sent', userId: newUser.id };
  }

  // 5. GET ALL USERS (Pagination & Filtering)
  async getAllUsers(page: number, limit: number, search: string, role: string) {
    const query = UserModel.query()
      .select('id', 'name', 'email', 'mobile', 'role', 'status', 'failed_attempts', 'locked_until')
      .page(page - 1, limit); // Objection pages start at 0

    if (search) {
      query.where((builder) => {
        builder.where('name', 'ilike', `%${search}%`)
               .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    if (role) {
      query.where('role', role);
    }

    return await query;
  }

  // 6. HELPER: Log Attempts
  private async logAttempt(userId: number | null, email: string, status: string, ip: string) {
    try {
        await LoginLogModel.query().insert({
        user_id: userId || undefined,
        email: email,
        status: status,
        ip_address: ip,
        });
    } catch (error) {
        console.error("Logging failed", error); // Don't crash app if logging fails
    }
  }
}