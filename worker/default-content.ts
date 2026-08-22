import { galleryImages, services, site } from "../site.config.mjs";

export type PriceItem = { label: string; price: string };
export type ServiceContent = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  startingPrice: string;
  category: string;
  visible: boolean;
  prices: PriceItem[];
};
export type GalleryContent = {
  id: number;
  image: string;
  title: string;
  alt: string;
  category: string;
  visible: boolean;
};
export type SiteContent = {
  services: Record<string, ServiceContent>;
  gallery: GalleryContent[];
  contact: {
    email: string;
    phone: string;
    instagram: string;
    instagramHandle: string;
    address: string;
    openingHours: string;
    bookingLink: string;
  };
  seo: {
    homepageTitle: string;
    metaDescription: string;
    socialDescription: string;
    defaultOgImage: string;
    businessName: string;
    canonicalDomain: string;
  };
  updatedAt: string;
};

export const DEFAULT_CONTENT: SiteContent = {
  services: Object.fromEntries(
    services.map((service) => [
      service.slug,
      {
        slug: service.slug,
        name: service.name,
        summary: service.summary,
        description: service.intro,
        startingPrice: service.startingPrice,
        category: service.eyebrow,
        visible: service.visible !== false,
        prices: service.prices.map(([label, price]) => ({ label, price })),
      },
    ])
  ),
  gallery: galleryImages.map(([image, , , alt, category], id) => ({
    id,
    image: String(image),
    title: String(category),
    alt: String(alt),
    category: String(category),
    visible: true,
  })),
  contact: {
    email: site.email,
    phone: "",
    instagram: site.instagram,
    instagramHandle: site.instagramHandle,
    address: "",
    openingHours: "",
    bookingLink: "",
  },
  seo: {
    homepageTitle: "Esencia Hair Studio | Hair, Extensions & Smoothing",
    metaDescription: "Personalised haircuts, extensions, styling and smoothing in a warm, refined studio experience.",
    socialDescription: "Personalised haircuts, extensions, styling and smoothing, delivered with care and a refined, wearable finish.",
    defaultOgImage: "/assets/images/brand/esencia-social-share.jpg",
    businessName: site.name,
    canonicalDomain: site.url,
  },
  updatedAt: new Date(0).toISOString(),
};
