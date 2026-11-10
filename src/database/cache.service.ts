// src/database/cache.service.ts
import { Injectable } from '@nestjs/common';
import { Redis, SetCommandOptions } from '@upstash/redis';

@Injectable()
export class CacheService {
    private readonly client: Redis;

    constructor() {
        // Initialize the stateless HTTP client using Upstash credentials
        this.client = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL || '',
            token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
        });

        console.log('🚀 Stateless Upstash HTTP Caching Client Initialized.');
    }

    // Universal HTTP safety wrapper with a strict timeout window
    private async withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Upstash HTTP Timeout of ${ms}ms reached`)), ms)
            ),
        ]);
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            // Upstash HTTP automatically handles JSON parsing under the hood
            const data = await this.withTimeout(this.client.get<T>(key));
            return data;
        } catch (error: any) {
            console.error(`⚠️ Redis GET bypassed (${error.message}). Serving from Prisma DB.`);
            return null;
        }
    }

    async set(key: string, value: any, ttlInSeconds?: number): Promise<void> {
        // Cast the dynamic object directly to SetCommandOptions
        const options: SetCommandOptions = ttlInSeconds !== undefined ? { ex: ttlInSeconds } : {};

        this.withTimeout(this.client.set(key, value, options))
            .then(() => {
                const ttlLog = ttlInSeconds !== undefined ? `TTL: ${ttlInSeconds}s` : 'Persistent';
                console.log(`✅ [Redis Cache] Saved key successfully: "${key}" (${ttlLog})`);
            })
            .catch((error: any) => {
                console.error(`⚠️ Async Redis SET skipped (${error.message}).`);
            });
    }

    async del(key: string): Promise<void> {
        try {
            await this.withTimeout(this.client.del(key));
            console.log(`🧹 Cache cleared: ${key}`);
        } catch (error: any) {
            console.error(`⚠️ Redis DEL bypassed (${error.message}).`);
        }
    }
}
