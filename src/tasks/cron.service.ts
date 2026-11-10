import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "src/database/prisma.service";

@Injectable()
export class CronService {

    constructor(private readonly prisma: PrismaService) { }

    @Cron(CronExpression.EVERY_HOUR)
    async cleanupExpiredOtps() {
        await this.prisma.forgotPassword.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        });
    }

}