import "../src/config/loadEnv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const templates = [
  ["Product promotion", "Product", "Showcase a product and its customer value.", "Highlight the product's strongest benefit, a specific feature, and a clear next step.", false],
  ["Service promotion", "Services", "Explain your service and the problem it solves.", "Describe the customer problem, your service approach, and a low-friction call to action.", false],
  ["New business announcement", "Announcement", "Introduce a new business to the community.", "Share who you are, what you offer, who you serve, and how people can connect.", false],
  ["Educational post", "Education", "Teach a useful, actionable tip.", "Open with a useful insight, explain it simply, and invite the reader to apply or discuss it.", false],
  ["Real estate listing", "Real estate", "Present a property with an inviting, factual description.", "Lead with the strongest property feature, describe key details accurately, and invite enquiries.", false],
  ["Restaurant special", "Food & hospitality", "Promote a dish, menu, or dining experience.", "Make the food sound appealing, include any provided location or price, and encourage a visit or booking.", false],
  ["Sale or discount", "Promotion", "Announce a time-limited promotion.", "State the offer and its terms clearly, communicate urgency without inventing details, and add a CTA.", true],
  ["Event invitation", "Events", "Invite the audience to an upcoming event.", "Explain what the event offers and include only the date, venue, and registration details provided.", true],
  ["Customer testimonial", "Community", "Share a customer success story respectfully.", "Frame the customer outcome in a warm, credible way. Do not invent a quote, name, or result.", true],
  ["Job announcement", "Hiring", "Announce an open role and attract qualified applicants.", "Describe the role and team opportunity, include provided requirements, and explain how to apply.", true],
] as const;

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seeding is disabled in production unless ALLOW_DEMO_SEED=true is explicitly set.");
  }

  for (const [name, category, description, prompt, isPremium] of templates) {
    await prisma.template.upsert({
      where: { name },
      update: { category, description, prompt, isPremium },
      create: { name, category, description, prompt, isPremium },
    });
  }

  const email = process.env.DEMO_EMAIL ?? "demo@postpilot.local";
  const password = process.env.DEMO_PASSWORD ?? "DemoPass123!";
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      subscription: {
        upsert: {
          create: { plan: "BUSINESS" },
          update: { plan: "BUSINESS" },
        },
      },
    },
    create: {
      name: "Demo Creator",
      email,
      passwordHash,
      subscription: { create: { plan: "BUSINESS" } },
    },
  });
  const brand = await prisma.brand.upsert({
    where: { id: "demo-brand" },
    update: {},
    create: {
      id: "demo-brand",
      userId: user.id,
      name: "Demo Coffee Co.",
      businessName: "Demo Coffee Co.",
      description: "A neighborhood coffee roaster serving thoughtfully sourced coffee.",
      industry: "Food & beverage",
      targetAudience: "Local coffee lovers and remote workers",
      website: "https://example.com",
      location: "Your city",
      brandVoice: "Friendly, thoughtful, and community-minded",
      commonCta: "Visit us this week",
      keywords: "specialty coffee, local, freshly roasted",
      isDefault: true,
    },
  });
  const template = await prisma.template.findUnique({ where: { name: "Product promotion" } });
  const existing = await prisma.content.findFirst({ where: { userId: user.id, title: "A better morning starts here" } });
  if (!existing) {
    const content = await prisma.content.create({
      data: {
        userId: user.id,
        brandId: brand.id,
        templateId: template?.id,
        title: "A better morning starts here",
        text: "Your morning ritual deserves coffee roasted with care. Drop by Demo Coffee Co. and find your new favorite cup. #SpecialtyCoffee #CoffeeLovers",
        platform: "Instagram",
        contentType: "Promotional",
        tone: "Friendly",
        isSaved: true,
      },
    });
    await prisma.favorite.create({ data: { contentId: content.id } });
    await prisma.calendarPost.create({
      data: {
        userId: user.id,
        contentId: content.id,
        title: "Coffee of the week",
        text: content.text,
        platform: content.platform,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: "SCHEDULED",
      },
    });
  }
  console.log(`Seed complete. Demo login: ${email} / ${password}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
