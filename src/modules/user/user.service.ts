import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { SubscribeDto, UserDto } from "./dto/user.dto";
import * as bcrypt from 'bcrypt';
import { ObjectId } from "mongodb";

@Injectable()
export class UserService {

    private readonly images = [
        'img-1.png', 'img-2.jpg', 'img-3.png', 'img-4.jpg', 'img-5.jpg', 'img-6.jpg', 'img-7.jpg', 'img-8.jpg'
    ];
    private randomImg() {
        return this.images[Math.floor(Math.random() * this.images.length)];
    }

    constructor(private readonly prisma: PrismaService) { }

    async getUserProfile(userId: string) {
        return await this.prisma.users.findUnique({
            where: { id: userId }
        });
    }

    async updateUserProfile(userId: string, dto: UserDto) {
        let hashedPassword: string | undefined;

        if (dto.password) {
            hashedPassword = await bcrypt.hash(dto.password, 10);
        }

        return await this.prisma.users.update({
            where: { id: userId },
            data: {
                username: dto.username,
                email: dto.email,
                ...(hashedPassword ? { password: hashedPassword } : {})
            }
        });
    }

    async getMyBlogs(userId: number) {
        const blogs = await this.prisma.blogDetails.findMany({
            where: { createdBy: userId },
            include: { author: true },
            orderBy: { createdAt: 'desc' }
        });

        return blogs.map(blog => {
            return { ...blog, image: this.randomImg() }
        });
    }


    async addSubscribers(dto: SubscribeDto) {
        const existingSubscriber = await this.prisma.subscribers.findUnique({
            where: { email: dto.email },
        });

        if (existingSubscriber) {
            throw new BadRequestException('Email ID already exists!');
        }

        await this.prisma.subscribers.create({
            data: { email: dto.email },
        });

        return { message: 'Thank you for subscribing!' };
    }

}