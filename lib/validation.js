import { z } from 'zod';

export const LoginSchema = z.object({
    username: z.string().min(1, 'Username is required.'),
    password: z.string().min(1, 'Password is required.')
});

export const HeroSchema = z.object({
    id: z.string().uuid('Hero ID must be a valid UUID.'),
    imageUrl: z.string().min(1, 'Hero image URL is required.')
});

export const PortfolioItemSchema = z.object({
    id: z.string().uuid('Project ID must be a valid UUID.'),
    order: z.number().int().min(1),
    title: z.string().default(''),
    description: z.string().default(''),
    link: z.string().default(''),
    imageUrl: z.string().min(1, 'Project image URL is required.'),
    section: z.string().default('Section 1')
});

export const FeedbackItemSchema = z.object({
    id: z.string().uuid('Feedback ID must be a valid UUID.'),
    order: z.number().int().min(1),
    clientName: z.string().min(1, 'Client name is required.'),
    text: z.string().min(1, 'Feedback text is required.'),
    rating: z.number().int().min(1).max(5),
    imageUrl: z.string().default('')
});

export const StatePayloadSchema = z.object({
    lastModified: z.number().int(),
    data: z.object({
        hero: HeroSchema,
        portfolio: z.array(PortfolioItemSchema).default([]),
        feedbacks: z.array(FeedbackItemSchema).default([])
    })
});
