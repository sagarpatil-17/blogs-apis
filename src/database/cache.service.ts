// src/database/cache.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
    public readonly client: Redis;

    constructor() {
        // 1. Connect directly to Upstash using ioredis
        this.client = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3, // Prevents hanging commands if the server drops
            disconnectTimeout: 2000,
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    return true;
                }
                return false;
            },
        });

        // 2. Clear error listeners that prevent Node runtime panics
        this.client.on('error', (err) => {
            console.warn('⚡ Upstash Redis Idle Disconnect Handled Safely:', err.message);
        });

        this.client.on('connect', () => {
            console.log('🚀 Successfully connected to Upstash Redis Cloud.');
        });
    }

    // Helper method to set data with a custom Time-To-Live (TTL) in seconds
    async set(key: string, value: any, ttlInSeconds = 300): Promise<void> {
        const stringData = typeof value === 'object' ? JSON.stringify(value) : value;
        await this.client.set(key, stringData, 'EX', ttlInSeconds);
    }

    // Helper method to fetch data automatically parsed back to JSON
    async get<T>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        if (!data) return null;
        try {
            return JSON.parse(data) as T;
        } catch {
            return data as unknown as T;
        }
    }

    // Clean up the network socket when NestJS shuts down
    onModuleDestroy() {
        this.client.disconnect();
    }
}
