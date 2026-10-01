export type User = { id: string; name: string; email: string; subscription?: { plan: string } };
export type Brand = {
  id: string; name: string; businessName?: string | null; description?: string | null;
  industry?: string | null; targetAudience?: string | null; website?: string | null;
  phone?: string | null; email?: string | null; location?: string | null;
  brandVoice?: string | null; commonCta?: string | null; keywords?: string | null;
  isDefault: boolean;
};
export type Content = {
  id: string; title: string | null; text: string; platform: string; contentType: string;
  tone: string; isSaved: boolean; createdAt: string; favorite?: { id: string } | null;
  variations?: Array<{ id: string; tone: string; text: string }>;
};
export type Template = { id: string; name: string; category: string; description: string; prompt: string; isPremium: boolean };
export type CalendarPost = {
  id: string; title: string; text: string; platform: string; scheduledAt: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
};
export type Analytics = {
  generatedThisMonth: number; savedPosts: number; favoritePosts: number; aiUsage: number;
  byPlatform: Array<{ name: string; count: number }>;
  byContentType: Array<{ name: string; count: number }>;
  monthlyActivity: Array<{ month: string; count: number }>;
  recent: Content[];
};
