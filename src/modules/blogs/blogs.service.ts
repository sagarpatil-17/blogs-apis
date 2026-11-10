import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { CreateBlogDto } from "./dto/createBlog.dto";
import { UpdateBlogDto } from "./dto/updateBlog.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { CacheService } from "src/database/cache.service";

@Injectable()
export class BlogsService {

    private cacheKey = 'blogs_homepage_data';
    private readonly images = [
        'img-1.png', 'img-2.jpg', 'img-3.png', 'img-4.jpg', 'img-5.jpg', 'img-6.jpg', 'img-7.jpg', 'img-8.jpg'
    ];
    private randomImg() {
        return this.images[Math.floor(Math.random() * this.images.length)];
    }

    constructor(private readonly prisma: PrismaService, private readonly cache: CacheService, private mail: MailerService) { }

    async getBlogs() {
        // 1. Check if the raw data exists in Upstash Redis Cloud
        let rawData: any = await this.cache.get(this.cacheKey);

        // 2. Cache Miss: Fetch data from Prisma Database if it's not in Redis
        if (!rawData) {
            console.log('⏳ Cache Miss. Running heavy Prisma transaction...');

            const [featured_blogs, latest_blogs, frontend_blogs, backend_blogs, fullstack_blogs] =
                await this.prisma.$transaction([
                    this.prisma.blogDetails.findMany({
                        where: { tags: { has: 'featured' } },
                        include: { author: true },
                        take: 2,
                        orderBy: { createdAt: 'desc' }
                    }),
                    this.prisma.blogDetails.findMany({
                        include: { author: true },
                        take: 3,
                        orderBy: { createdAt: 'desc' }
                    }),
                    this.prisma.blogDetails.findMany({
                        where: { tags: { has: 'frontend' } },
                        include: { author: true },
                        take: 3,
                        orderBy: { createdAt: 'desc' }
                    }),
                    this.prisma.blogDetails.findMany({
                        where: { tags: { has: 'backend' } },
                        include: { author: true },
                        take: 3,
                        orderBy: { createdAt: 'desc' }
                    }),
                    this.prisma.blogDetails.findMany({
                        where: { tags: { has: 'fullstack' } },
                        include: { author: true },
                        take: 3,
                        orderBy: { createdAt: 'desc' }
                    })
                ]);

            rawData = {
                featured_blogs,
                latest_blogs,
                frontend_blogs,
                backend_blogs,
                fullstack_blogs
            };

            // 🟢 FIX: Pass 600 SECONDS (10 minutes) instead of 600000 milliseconds
            // This now correctly aligns with your CacheService implementation
            try {
                await this.cache.set(this.cacheKey, rawData, 600);
                console.log('✅ Successfully triggered data payload write to Redis Cloud!');
            } catch (cacheError) {
                console.error('❌ Redis cache.set invocation failed:', cacheError);
            }
        } else {
            console.log('🚀 Serving raw blog records from Upstash Redis!');
        }

        // 3. Fallback Safety: In case rawData was parsed incorrectly, ensure it exists
        if (!rawData || !rawData.featured_blogs) {
            console.warn('⚠️ Cache payload structure invalid or empty. Returning empty sets.');
            return { featured_blogs: [], latest_blogs: [], frontend_blogs: [], backend_blogs: [], fullstack_blogs: [] };
        }

        // 4. Always apply dynamic logic (like randomImg) on the raw array collections
        return {
            featured_blogs: rawData.featured_blogs.map(blog => ({ ...blog, image: this.randomImg() })),
            latest_blogs: rawData.latest_blogs.map(blog => ({ ...blog, image: this.randomImg() })),
            frontend_blogs: rawData.frontend_blogs.map(blog => ({ ...blog, image: this.randomImg() })),
            backend_blogs: rawData.backend_blogs.map(blog => ({ ...blog, image: this.randomImg() })),
            fullstack_blogs: rawData.fullstack_blogs.map(blog => ({ ...blog, image: this.randomImg() })),
        };
    }


    async getBlogsByTags(tag: string) {
        let blogs = undefined;

        if (tag == 'latest') {
            blogs = await this.prisma.blogDetails.findMany({
                include: { author: true }
            });
        } else {
            blogs = await this.prisma.blogDetails.findMany({
                where: {
                    tags: { has: tag }
                },
                include: { author: true }
            });
        }

        return blogs.map(blog => {
            return { ...blog, image: this.randomImg() }
        })
    }

    async getBlogDetail(blog_id: string) {
        const blogDetail = await this.prisma.blogDetails.findUnique({
            where: { id: blog_id },
            include: { author: true }
        });

        if (!blogDetail) {
            throw new Error(`Blog with id ${blog_id} not found`)
        }

        return { ...blogDetail, image: this.randomImg() }
    }

    async createBlogs(dto: CreateBlogDto, req) {
        // Create the blog entry in the database
        const blog = await this.prisma.blogDetails.create({
            data: {
                ...dto,
                createdBy: req.userId,
            },
        });

        await this.cache.del(this.cacheKey);

        // Email template
        const template = `<div style="max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <!-- Header Section -->
            <div style="background-color: #38bdf8; color: #fff; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">New Blog Published</h1>
            </div>
    
            <!-- Content Section -->
            <div style="padding: 20px;">
                <p style="line-height: 1.6; margin: 0 0 15px;">Hi Sir / Madam,</p>
                <p style="line-height: 1.6; margin: 0 0 15px;">We’re excited to announce a new blog post on our website!</p>
                <p style="color: #38bdf8; font-size: 20px; margin: 10px 0; font-weight: bold;">${blog.title}</p>
                <a href="https://coding-blogs-seven.vercel.app/blogs/details/${blog.id}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #38bdf8; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Read Full Blog</a>
            </div>
    
            <!-- Footer Section -->
            <div style="background-color: #f1f1f1; text-align: center; padding: 10px; font-size: 14px; color: #777;">
                <p style="margin: 5px 0;">Thank you for staying connected with us.</p>
                <p style="margin: 5px 0;"><a href="https://coding-blogs-seven.vercel.app/blogs" style="color: #38bdf8; text-decoration: none;">Visit our website</a> for more updates.</p>
            </div>
        </div>`;

        // Fetch subscribers
        const subscribers = await this.prisma.subscribers.findMany();

        // Send emails to all subscribers
        try {
            await Promise.all(
                subscribers.map((user) =>
                    this.mail.sendMail({
                        subject: `New Blog Alert: ${blog.title}`,
                        to: user.email,
                        html: template,
                        from: 'Code Plus <codeplus26@gmail.com>',
                    })
                )
            );
        } catch (error) {
            console.error('Error sending email:', error);
        }

        return { message: 'Blog created successfully!' };
    }

    async updateBlogs(blogId: string, dto: UpdateBlogDto) {
        const blog = await this.prisma.blogDetails.update({
            where: { id: blogId },
            data: {
                ...dto,
            }
        })

        await this.cache.del(this.cacheKey);

        return blog;
    }

    async deleteBlog(blogId: string) {
        await this.prisma.blogDetails.delete({
            where: { id: blogId }
        })

        await this.cache.del(this.cacheKey);

        return { message: 'Blog deleted successfully!' }
    }

    async searchBlogs(searchedText: string) {
        const blogs = await this.prisma.blogDetails.findMany({
            where: { title: { contains: searchedText, mode: 'insensitive' } },
            include: { author: true }
        })

        return blogs.map(blog => {
            return { ...blog, image: this.randomImg() }
        })
    }

}