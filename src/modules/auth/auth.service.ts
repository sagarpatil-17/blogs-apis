import { BadRequestException, Body, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { ForgotPasswordDto, LoginDto, ResetPasswordDto, SignUpDto } from "./dto/auth.dto";
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from "@nestjs/jwt";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class AuthService {

    constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService, private mail: MailerService) { }

    async signUp(signUpDto: SignUpDto) {
        try {
            const randomNumber = Date.now();
            const hashedPassword = await bcrypt.hash(signUpDto.password, 10);

            return this.prisma.users.create({
                data: {
                    username: signUpDto.username,
                    email: signUpDto.email,
                    password: hashedPassword,
                    role: '2',
                    userId: randomNumber
                }
            })
        } catch (error) {
            throw new InternalServerErrorException('Failed to signup')
        }
    }

    async login(@Body() loginDto: LoginDto) {
        const user = await this.prisma.users.findUnique({
            where: { email: loginDto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid Credentials!');
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid Credentials!');
        }

        // Generate JWT payload
        const payload = { id: user.id, username: user.username, email: user.email, userId: user.userId, role: user.role };
        return { auth_token: this.jwtService.sign(payload), user_info: payload };
    }

    async verifyEmail(dto: ForgotPasswordDto) {

        const user = await this.prisma.users.findUnique({
            where: { email: dto.email }
        });

        if (!user) {
            throw new BadRequestException('Email not found!');
        }

        // Generate a 4-digit OTP and set its expiration time
        const otp = crypto.randomInt(1000, 9999).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

        // Create or update the forgot password record in the database
        await this.prisma.forgotPassword.create({
            data: {
                email: dto.email,
                otp: +otp,
                expiresAt
            }
        });

        await this.mail.sendMail({
            subject: 'Your OTP Code',
            to: dto.email,
            html: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
            from: 'Code plus codeplus26@gmail.com'
        });

        return { message: "OTP sent successfully!" }

    }

    async verifyPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.forgotPassword.findUnique({
            where: { email: dto.email }
        });

        if (user.otp != Number(dto.otp)) {
            throw new Error('Invalid OTP. Please try again.');
        }

        await this.prisma.forgotPassword.delete({
            where: { email: dto.email },
        });

        return { message: 'OTP verified successfully!' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        await this.prisma.users.update({
            where: { email: dto.email },
            data: { password: hashedPassword }
        })

        return { message: 'Success!, You can login now' }
    }

}