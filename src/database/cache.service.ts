// src/database/cache.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
    public readonly client: Redis;

    constructor() {
        const redisUrl = process.env.REDIS_URL;

        this.client = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: true,

            // 🛠️ 1. Force TLS settings (Required for secure cloud links like Upstash)
            tls: redisUrl.startsWith('rediss://') ? {} : undefined,

            // 🛠️ 2. Add TCP keepAlive to prevent Upstash from closing the line due to inactivity
            kafka: undefined, // avoids structural overlap
            keepAlive: 30000, // Pings every 30 seconds to keep the line active

            retryStrategy(times) {
                // Back off the retry window gradually so it doesn't spam requests when offline
                const delay = Math.min(times * 100, 5000);
                return delay;
            },
        } as any);

        // 🛠️ 3. Change console.warn to a clean single line so it doesn't flood your screen
        this.client.on('error', (err) => {
            // Quietly logs the disconnect without spamming full stack details
            if (err.message.includes('ECONNRESET')) {
                // Option to comment this line out entirely once you confirm it works
                console.log('🔄 Upstash connection reset detected. Reconnecting background socket...');
            } else {
                console.warn('⚠️ Redis Connection Error:', err.message);
            }
        });

        this.client.on('connect', () => {
            console.log('🚀 Connected securely to Upstash Redis Cloud.');
        });
    }

    // UNIVERSAL TIMEOUT WRAPPER
    private async withTimeout<T>(promise: Promise<T>, ms = 1000): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Redis timeout reached')), ms)
            ),
        ]);
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.withTimeout(this.client.get(key));
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            console.error('⚠️ Redis GET bypassed (Timeout/Offline). Defaulting to Prisma DB.');
            return null;
        }
    }

    async set(key: string, value: any, ttlInSeconds = 300): Promise<void> {
        try {
            const stringData = typeof value === 'object' ? JSON.stringify(value) : value;
            await this.withTimeout(this.client.set(key, stringData, 'EX', ttlInSeconds));
        } catch (error) {
            console.error('⚠️ Redis SET bypassed (Timeout/Offline).');
        }
    }

    async del(key: string): Promise<void> {
        try {
            // If Redis takes > 1 second to respond, abort it and move on
            await this.withTimeout(this.client.del(key));
            console.log(`🧹 Cache cleared successfully for key: ${key}`);
        } catch (error) {
            console.error(`⚠️ Redis DEL bypassed for key ${key} (Timeout/Offline).`);
        }
    }

    onModuleDestroy() {
        this.client.disconnect();
    }
}
