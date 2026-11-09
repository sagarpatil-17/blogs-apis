// src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CacheService } from './cache.service';

@Global()
@Module({
    providers: [PrismaService, CacheService],
    exports: [PrismaService, CacheService],
})
export class DatabaseModule { }
