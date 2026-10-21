import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

import { apiVersion, dataset, projectId } from "../sanity/env";

type Work = {
  title: string;
  type: string;
  production: string;
  year: string | number;
  imageUrl: string;
  link: string;
  featuredLayout?: "auto" | "standard" | "wide";
  role?: string;
  previewTitle?: string;
  synopsis?: string;
};

type Testimonial = {
  quote: string;
  name: string;
  title: string;
  rating: number;
  image: string;
};

type FocusCard = {
  title: string;
  description: string;
  color: string;
};

type SeedDocument = Record<string, unknown> & { _type: string };

const token = process.env.SANITY_API_WRITE_TOKEN;

if (!token) {
  throw new Error("Missing environment variable: SANITY_API_WRITE_TOKEN");
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});
const root = process.cwd();

const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as T;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const keyFor = (value: string, index: number) =>
  `${slugify(value)}-${index + 1}`;

async function imageField(publicPath?: string) {
  if (!publicPath) return undefined;

  const relativePath = publicPath.replace(/^\//, "");
  const filePath = path.join(root, "public", relativePath);
  if (!fs.existsSync(filePath)) return undefined;

  const filename = path.basename(filePath);
  const existingAsset = await client.fetch<{ _id: string } | null>(
    `*[_type == "sanity.imageAsset" && originalFilename == $filename][0]{_id}`,
    { filename },
  );

  const asset =
    existingAsset ??
    (await client.assets.upload("image", fs.createReadStream(filePath), {
      filename,
    }));

  return {
    _type: "image",
    asset: {
      _type: "reference",
      _ref: asset._id,
    },
  };
}

async function upsertSingleton(id: string, doc: SeedDocument) {
  await client.createOrReplace({
    _id: id,
    ...doc,
  });
}

async function upsertByQuery(
  query: string,
  params: Record<string, unknown>,
  doc: SeedDocument,
) {
  const existing = await client.fetch<{ _id: string } | null>(query, params);

  if (existing?._id) {
    await client.patch(existing._id).set(doc).commit();
    return existing._id;
  }

  const created = await client.create(doc);
  return created._id;
}

async function seedHomePage() {
  const gallery =
    readJson<Array<{ src: string; alt: string }>>("data/gallery.json");

  await upsertSingleton("homePage", {
    _type: "homePage",
    heroHeadline: "LAUGHTER EPHRAIM",
    heroIntro:
      "I am an AMVCA-nominated film editor with a passion to create stories. With 6 years in the film industry, I have developed a love for bringing stories to life with precision and creativity.",
    heroCtaLabel: "Get in touch",
    heroCtaLink: "/#contact-me",
    gallery: await Promise.all(
      gallery.map(async (item, index) => ({
        _key: keyFor(item.alt, index),
        _type: "object",
        image: await imageField(item.src),
        alt: item.alt,
      })),
    ),
    quoteText:
      "The essence of cinema is editing. It's the combination of what can be extraordinary images of people during emotional moments, or images in a general sense, put together in a kind of alchemy.",
    quoteAttribution: "Francis Ford Coppola",
  });
}

async function seedAboutPage() {
  const focusCards = readJson<FocusCard[]>("data/about.json");
  const tools =
    readJson<Array<{ id: string; icon: string; label: string }>>(
      "data/tools.json",
    );
  const brands =
    readJson<Array<{ id: string; icon: string }>>("data/brands.json");

  await upsertSingleton("aboutPage", {
    _type: "aboutPage",
    headline: "About Laughter",
    body: "Hi there! I'm Laughter Ephraim, an AMVCA-nominated film editor with a passion to create stories. With 6 years in the film industry, I have developed a love for bringing stories to life with precision and creativity. I believe in the power of storytelling and its ability to connect, inspire and entertain. It's more than just editing. It's about conveying a message that matters.",
    headshot: await imageField("/images/laughter-headshot.jpg"),
    focusCards: focusCards.map((card, index) => ({
      _key: keyFor(card.title, index),
      _type: "object",
      title: card.title,
      description: card.description,
      color: card.color,
    })),
    tools: tools.map((tool, index) => ({
      _key: keyFor(tool.label, index),
      _type: "object",
      label: tool.label,
      iconPath: tool.icon,
    })),
    brands: brands.map((brand, index) => ({
      _key: keyFor(brand.id, index),
      _type: "object",
      label: brand.id,
      logoPath: brand.icon,
    })),
  });
}

async function seedSiteSettings() {
  const socials =
    readJson<Array<{ label: string; link: string }>>("data/socials.json");

  await upsertSingleton("siteSettings", {
    _type: "siteSettings",
    contactHeading: "Contact Me",
    contactIntro:
      "Get an inside look at the edits, stories, and moments that shaped each frame.",
    email: "laughter.eo@gmail.com",
    bookingLink: "https://calendar.app.google/f4RhQrpnjYe2uv6y5",
    socials: socials.map((social, index) => ({
      _key: keyFor(social.label, index),
      _type: "object",
      label: social.label,
      link: social.link,
    })),
    seoTitle: "Laughter Ephraim - Film Editor",
    seoDescription:
      "Laughter Ephraim is an AMVCA-nominated film editor with 6+ years of experience crafting stories with precision and creativity.",
    ogImage: await imageField("/android-chrome-512x512.png"),
  });
}

async function seedWorks() {
  const works = readJson<Work[]>("data/works.json");
  const selectedWorks = readJson<Work[]>("data/selected-works.json");
  const featuredOrderByTitle = new Map(
    selectedWorks.map((work, index) => [work.title, index + 1]),
  );
  const featuredLayoutByTitle = new Map(
    selectedWorks.map((work) => [
      work.title,
      work.featuredLayout ?? "standard",
    ]),
  );

  for (const work of works) {
    const featuredOrder = featuredOrderByTitle.get(work.title);

    await upsertByQuery(
      `*[_type == "work" && title == $title && production == $production][0]{_id}`,
      { title: work.title, production: work.production },
      {
        _type: "work",
        title: work.title,
        type: work.type,
        production: work.production,
        year: Number(work.year),
        role: work.role,
        synopsis: work.synopsis,
        image: await imageField(work.imageUrl),
        imagePath: work.imageUrl,
        link: work.link,
        previewTitle: work.previewTitle,
        featured: Boolean(featuredOrder),
        featuredOrder,
        featuredLayout: featuredOrder
          ? (featuredLayoutByTitle.get(work.title) ?? "standard")
          : undefined,
      },
    );
  }
}

async function seedTestimonials() {
  const testimonials = readJson<Testimonial[]>("data/testimonials.json");

  for (const [index, testimonial] of testimonials.entries()) {
    await upsertByQuery(
      `*[_type == "testimonial" && name == $name][0]{_id}`,
      { name: testimonial.name },
      {
        _type: "testimonial",
        name: testimonial.name,
        title: testimonial.title,
        quote: testimonial.quote,
        rating: testimonial.rating,
        image: await imageField(testimonial.image),
        imagePath: testimonial.image,
        order: index + 1,
        visible: true,
      },
    );
  }
}

async function main() {
  await seedHomePage();
  await seedAboutPage();
  await seedSiteSettings();
  await seedWorks();
  await seedTestimonials();
  console.log("Seeded Sanity with current portfolio content.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
