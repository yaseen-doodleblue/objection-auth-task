import { Injectable, ConflictException, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserModel } from '../models/user.model';
import { LoginLogModel } from '../models/login-log.model';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import PDFDocument = require('pdfkit');
import { parse } from 'json2csv';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private mailerService: MailerService) {}
  
  // 1. SIGN UP (Public)
  async signUp(data: any) {
    const existingUser = await UserModel.query().findOne({ email: data.email });
    if (existingUser) throw new ConflictException('Email already exists');

    const existingMobile = await UserModel.query().findOne({ mobile: data.mobile });
    if (existingMobile) throw new ConflictException('Mobile number already exists');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const newUser = await UserModel.query().insert({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role,
      status: data.status || 'Active',
    });

    return { message: 'User registered successfully', userId: newUser.id };
  }

  // 2. SIGN IN (With Rate Limiting & Locking)
  async signIn(data: any) {
    const user = await UserModel.query().findOne({ email: data.email });
    
    if (!user) {
      await this.logAttempt(null, data.email, 'Failed (User Not Found)');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      await this.logAttempt(user.id, user.email, 'Failed (Locked)');
      throw new ForbiddenException('Account is temporarily locked. Try again in 15 mins.');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    
    if (!isMatch) {
      const newFailCount = (user.failed_attempts || 0) + 1;
      
      if (newFailCount >= 5) {
        const lockTime = new Date();
        lockTime.setMinutes(lockTime.getMinutes() + 15);

        await UserModel.query().patchAndFetchById(user.id, {
          failed_attempts: newFailCount,
          locked_until: lockTime.toISOString(),
        });

        try {
            await this.mailerService.sendMail({
            to: user.email,
            subject: 'Security Alert: Account Locked',
            template: './account-locked', 
            context: { name: user.name },
            });
        } catch (e) { console.log('Email error:', e); }

        await this.logAttempt(user.id, user.email, 'Failed (Locked Triggered)');
        throw new ForbiddenException('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        await UserModel.query().patchAndFetchById(user.id, {
          failed_attempts: newFailCount,
        });
        
        await this.logAttempt(user.id, user.email, 'Failed (Wrong Password)');
        throw new UnauthorizedException(`Invalid credentials. Attempts remaining: ${5 - newFailCount}`);
      }
    }

    // SUCCESS
    if (user.failed_attempts > 0 || user.locked_until) {
      await UserModel.query().patchAndFetchById(user.id, {
        failed_attempts: 0,
        locked_until: null,
      });
      
      try {
        await this.mailerService.sendMail({
          to: user.email,
          subject: 'Security Update: Account Restored',
          template: './account-activated',
          context: { name: user.name },
        });
      } catch (e) { console.log('Activation email failed:', e); }
    }

    await this.logAttempt(user.id, user.email, 'Success');

    const payload = { userId: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return { message: 'Login successful', access_token: token, expiresIn: '5m' };
  }

  // 3. GET PROFILE (With Relations)
  async getProfile(userId: number) {
      try {
          const user = await UserModel.query()
            .findById(userId)
            .withGraphFetched('[address, bank_details]'); 

          if (!user) {
            throw new UnauthorizedException('User not found');
          }

          const { password, ...result } = user;
          return result;
      } catch (error) {
          console.error("CRITICAL DB ERROR:", error);  
          throw error;
      }
    }

  // 4. ADD EMPLOYEE (Cascading Insert using insertGraph)
  async addEmployee(data: any) {
    const existingUser = await UserModel.query().findOne({ email: data.email });
    if (existingUser) throw new ConflictException('Email already exists');

    const existingMobile = await UserModel.query().findOne({ mobile: data.mobile });
    if (existingMobile) throw new ConflictException('Mobile number already exists');

    const rawPassword = data.password || Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const newUser = await UserModel.query().insertGraph({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      role: data.role, 
      status: 'Active',
      address: data.address, 
      bank_details: data.bank_details
    });

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

    return { message: 'Employee added (Cascading) and email sent', userId: newUser.id };
  }

  // 5. GET ALL USERS (With Pagination)
  async getAllUsers(page: number, limit: number, search: string, role: string) {
    const query = UserModel.query()
      .select('id', 'name', 'email', 'mobile', 'role', 'status')
      .withGraphFetched('[address, bank_details]') 
      .page(page - 1, limit);

    if (search) {
      query.where((builder) => {
        builder.where('name', 'ilike', `%${search}%`).orWhere('email', 'ilike', `%${search}%`);
      });
    }

    if (role) {
      query.where('role', role);
    }

    return await query;
  }

  // 6. CSV EXPORT (Updated to include ALL fields)
  async generateCsvExport() {
    const users = await UserModel.query().withGraphFetched('[address, bank_details]');
    
    const flatData = users.map(u => ({
      ID: u.id,
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Mobile: u.mobile,
      Street: u.address?.street || 'N/A',
      City: u.address?.city || 'N/A',
      State: u.address?.state || 'N/A',
      Zip: u.address?.zip_code || 'N/A',
      Country: u.address?.country || 'N/A',
      Bank_Name: u.bank_details?.bank_name || 'N/A',
      Account_No: u.bank_details?.account_number ? `'${u.bank_details.account_number}` : 'N/A', 
      IFSC: u.bank_details?.ifsc_code || 'N/A',
      Branch: u.bank_details?.branch_name || 'N/A'
    }));

    const fields = [
      'ID', 'Name', 'Email', 'Role', 'Mobile', 
      'Street', 'City', 'State', 'Zip', 'Country', 
      'Bank_Name', 'Account_No', 'IFSC', 'Branch'
    ];
    
    const csv = parse(flatData, { fields });
    return csv;
  }

  // 7. PDF EXPORT
  async generatePdfExport(userId: number): Promise<Buffer> {
    const user = await UserModel.query().findById(userId).withGraphFetched('[address, bank_details]');
    if (!user) throw new NotFoundException('User not found');

    return new Promise((resolve) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(20).text('Employee Profile', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Name: ${user.name}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Role: ${user.role}`);
      doc.text(`Mobile: ${user.mobile}`);
      doc.moveDown();

      doc.fontSize(16).text('Address Details', { underline: true });
      if (user.address) {
        doc.fontSize(12).text(`${user.address.street}, ${user.address.city}`);
        doc.text(`${user.address.state} - ${user.address.zip_code}`);
        doc.text(user.address.country);
      } else {
        doc.fontSize(12).text('No address provided.');
      }
      doc.moveDown();

      doc.fontSize(16).text('Bank Details', { underline: true });
      if (user.bank_details) {
        doc.fontSize(12).text(`Bank: ${user.bank_details.bank_name}`);
        doc.text(`Account No: ${user.bank_details.account_number}`);
        doc.text(`IFSC: ${user.bank_details.ifsc_code}`);
        doc.text(`Branch: ${user.bank_details.branch_name}`);
      } else {
        doc.fontSize(12).text('No bank details provided.');
      }

      doc.end();
    });
  }

  // HELPER: Log Attempts
  private async logAttempt(userId: number | null, email: string, status: string) {
    try {
        await LoginLogModel.query().insert({
          user_id: userId || undefined,
          email: email,
          status: status,
        });
    } catch (error) { console.error("Logging failed", error); }
  }

  // 8. DELETE USER
  async deleteUser(id: number) {
    const rowsDeleted = await UserModel.query().deleteById(id);
    
    if (rowsDeleted === 0) {
        throw new NotFoundException('User not found');
    }
    
    return { message: 'User deleted successfully', id };
  }

  // 9. UPDATE USER (Fixed: TypeScript Errors Solved)
  async updateUser(id: number, data: any) {
    const user = await UserModel.query().findById(id).withGraphFetched('[address, bank_details]');
    
    if (!user) throw new NotFoundException('User not found');

    // FIX: Add ': any' type here so TypeScript knows it's safe to add properties later
    let addressPayload: any = undefined; 
    
    if (data.address) {
        addressPayload = {
            ...data.address,
            user_id: id 
        };
        // Now TypeScript won't complain here
        if (user.address) {
            addressPayload.id = user.address.id;
        }
    }

    // FIX: Add ': any' here too
    let bankPayload: any = undefined;
    
    if (data.bank_details) {
        bankPayload = {
            ...data.bank_details,
            user_id: id
        };
        // And here
        if (user.bank_details) {
            bankPayload.id = user.bank_details.id;
        }
    }

    const updatedUser = await UserModel.query().upsertGraph({
      id: id, 
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      role: data.role,
      address: addressPayload,
      bank_details: bankPayload
    });

    return { message: 'User updated successfully', user: updatedUser };
  }

}