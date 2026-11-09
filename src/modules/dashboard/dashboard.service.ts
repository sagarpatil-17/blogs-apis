import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";

@Injectable()
export class DashboardService {

    constructor(private readonly prisma: PrismaService) { }

    async getDashboardDetails() {
        const [web, frontend, backend, fullstack, total] = await this.prisma.$transaction([
            this.prisma.blogDetails.count({
                where: { tags: { has: 'web' } }
            }),
            this.prisma.blogDetails.count({
                where: { tags: { has: 'frontend' } }
            }),
            this.prisma.blogDetails.count({
                where: { tags: { has: 'backend' } }
            }),
            this.prisma.blogDetails.count({
                where: { tags: { has: 'fullstack' } }
            }),
            this.prisma.blogDetails.count()
        ]);

        const other = total - (web + frontend + backend + fullstack);

        return [
            { type: 'Web', count: web },
            { type: 'Frontend', count: frontend },
            { type: 'Backend', count: backend },
            { type: 'Fullstack', count: fullstack },
            { type: 'Other', count: other },
        ]
    }

}