import { z } from "zod";

export const platforms = ["Facebook", "Instagram", "LinkedIn", "X", "TikTok"] as const;
export const contentTypes = [
  "Promotional",
  "Educational",
  "Informational",
  "Engagement",
  "Announcement",
  "Story",
  "Product Launch",
  "Sale/Discount",
] as const;
export const tones = [
  "Professional",
  "Friendly",
  "Funny",
  "Persuasive",
  "Inspirational",
  "Luxury",
  "Casual",
  "Urgent",
] as const;
export const platformSchema = z.enum(platforms);
export const contentTypeSchema = z.enum(contentTypes);
export const toneSchema = z.enum(tones);
export const campaignGoals = [
  "Awareness",
  "Engagement",
  "Website traffic",
  "Lead generation",
  "Sales",
  "Community growth",
] as const;
export const hookStyles = [
  "Auto",
  "Question",
  "Bold statement",
  "Curiosity",
  "Mini story",
  "Direct benefit",
] as const;

export const generationSchema = z.object({
  platform: platformSchema,
  contentType: contentTypeSchema,
  tone: toneSchema,
  length: z.enum(["Short", "Medium", "Long"]),
  description: z.string().trim().min(3).max(3000),
  audience: z.string().max(500).optional(),
  location: z.string().max(250).optional(),
  price: z.string().max(100).optional(),
  callToAction: z.string().max(300).optional(),
  website: z.string().max(300).optional(),
  contactInformation: z.string().max(300).optional(),
  keywords: z.string().max(500).optional(),
  campaignGoal: z.enum(campaignGoals).optional(),
  keyMessage: z.string().max(500).optional(),
  hookStyle: z.enum(hookStyles).optional(),
  emojiStyle: z.enum(["None", "Subtle", "Expressive"]).optional(),
  deepResearch: z.boolean().optional(),
  brandId: z.string().optional(),
  templateId: z.string().optional(),
  variations: z.boolean().optional(),
});
