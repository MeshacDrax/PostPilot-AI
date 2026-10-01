import { Plan, Prisma, UsageStatus } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../utils/http";

export const PLAN_LIMITS: Record<Plan, { generations: number; savedPosts: number | null; brands: number | null }> = {
  FREE: { generations: 5, savedPosts: 10, brands: 1 },
  CREATOR: { generations: 100, savedPosts: null, brands: 1 },
  BUSINESS: { generations: 500, savedPosts: null, brands: null },
  AGENCY: { generations: 10_000, savedPosts: null, brands: null },
};

export async function reserveGeneration(userId: string, action: string, generationCount = 1) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const subscription = await tx.subscription.findUnique({ where: { userId } });
          const plan = subscription?.plan ?? Plan.FREE;
          const limit = PLAN_LIMITS[plan].generations;
          const count = await tx.aIUsage.aggregate({
            where: {
              userId,
              createdAt: { gte: monthStart },
              status: { in: [UsageStatus.PENDING, UsageStatus.SUCCESS] },
            },
            _sum: { generationCount: true },
          });
          if ((count._sum.generationCount ?? 0) + generationCount > limit) {
            throw new ApiError(402, `Monthly AI generation limit reached for the ${plan} plan.`);
          }
          return tx.aIUsage.create({
            data: { userId, action, generationCount, status: UsageStatus.PENDING },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new ApiError(503, "Unable to reserve AI usage. Please retry.");
}

export async function finishGeneration(id: string, success: boolean, tokensUsed?: number) {
  await prisma.aIUsage.update({
    where: { id },
    data: {
      status: success ? UsageStatus.SUCCESS : UsageStatus.FAILED,
      ...(success && tokensUsed !== undefined ? { tokensUsed } : {}),
    },
  });
}

export async function ensureCanSave(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const limit = PLAN_LIMITS[subscription?.plan ?? Plan.FREE].savedPosts;
  if (limit === null) return;
  const count = await prisma.content.count({ where: { userId, isSaved: true } });
  if (count >= limit) {
    throw new ApiError(402, `Saved post limit reached for the ${subscription?.plan ?? Plan.FREE} plan.`);
  }
}

export async function ensureCanCreateBrand(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const limit = PLAN_LIMITS[subscription?.plan ?? Plan.FREE].brands;
  if (limit !== null && (await prisma.brand.count({ where: { userId } })) >= limit) {
    throw new ApiError(402, "Your plan does not allow another brand profile.");
  }
}

export async function ensurePlan(userId: string, allowedPlans: Plan[], feature: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const plan = subscription?.plan ?? Plan.FREE;
  if (!allowedPlans.includes(plan)) {
    throw new ApiError(402, `${feature} is not available on the ${plan} plan.`);
  }
}
