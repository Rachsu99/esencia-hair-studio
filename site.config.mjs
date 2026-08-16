export const site = {
  name: "Esencia Hair Studio",
  shortName: "Esencia",
  tagline: "Beautiful hair. Effortlessly you.",
  url: "https://esenciahair.co.nz",
  email: "Rachsu99@gmail.com",
  instagram: "https://www.instagram.com/hairbyrachel.nz?igsh=MXNiemsxM3E0N3VucA%3D%3D&utm_source=qr",
  instagramHandle: "@hairbyrachel.nz",
};

export const pricingNote =
  "Keratin and Nanoplasty prices are based on hair length, thickness and the amount of product required. Final pricing will be confirmed following consultation.";

export const services = [
  {
    slug: "haircuts",
    file: "haircuts.html",
    name: "Ladies Haircuts",
    eyebrow: "Shape · movement · ease",
    summary: "A considered cut shaped around your hair, personal style and everyday routine.",
    intro: "A thoughtful haircut begins with listening. We consider the way your hair naturally falls, how you like to wear it and how much styling you want to do at home.",
    suit: "Ideal when you want to refresh your shape, restore movement or create a more manageable everyday style.",
    startingPrice: "$85",
    image: "assets/images/editorial/long-hair.webp",
    width: 1400,
    height: 2100,
    alt: "Woman with softly styled long brown hair",
    benefits: ["Personal consultation", "Shape tailored to you", "Wearable finish", "Styling guidance"],
    prices: [
      ["Ladies Haircut", "$85"],
      ["Shampoo, Treatment & Haircut", "$95"],
    ],
  },
  {
    slug: "keratin",
    file: "keratin.html",
    name: "Keratin Smoothing",
    eyebrow: "Soft · smooth · polished",
    summary: "Professional smoothing designed to reduce frizz and make everyday styling feel easier.",
    intro: "Keratin smoothing is designed for clients seeking softer-feeling, more manageable hair with a beautifully polished finish. Your consultation helps us tailor the service to your hair.",
    suit: "It may suit hair that feels frizz-prone, difficult to manage or slower to style. A consultation is the best way to confirm the result that is realistic for your hair.",
    startingPrice: "from $180",
    image: "assets/images/editorial/silky-hair.webp",
    width: 1400,
    height: 934,
    alt: "Woman with long smooth dark hair",
    benefits: ["Reduced frizz", "Easier styling", "Softer feel", "Smoother finish", "Improved manageability", "Polished appearance"],
    prices: [
      ["Short Hair", "from $180"],
      ["Medium Hair", "from $230"],
      ["Long Hair", "from $280"],
      ["Extra Long / Thick Hair", "from $330"],
    ],
  },
  {
    slug: "nanoplasty",
    file: "nanoplasty.html",
    name: "Nanoplasty",
    eyebrow: "Sleek · glossy · refined",
    summary: "An advanced smoothing service for a sleek, glossy and more manageable finish.",
    intro: "Nanoplasty is an advanced smoothing option for clients wanting a sleeker finish and more manageable hair. A consultation is essential so we can assess your hair and desired result.",
    suit: "It may suit clients looking for a sleeker overall finish and a significant change in daily manageability, subject to an individual hair assessment.",
    startingPrice: "from $280",
    image: "assets/images/editorial/glossy-hair.webp",
    width: 1400,
    height: 2101,
    alt: "Woman with long glossy brunette hair",
    benefits: ["Intense smoothing", "Frizz reduction", "Sleek finish", "Glossy appearance", "Softer feel", "Easier daily styling"],
    prices: [
      ["Short Hair", "from $280"],
      ["Medium Hair", "from $340"],
      ["Long Hair", "from $400"],
      ["Extra Long / Thick Hair", "from $550"],
    ],
  },
];

export const treatmentFaqs = [
  ["How much does Keratin smoothing cost?", "Pricing starts from $180 and varies with hair length, thickness and the amount of product required. Final pricing is confirmed following consultation."],
  ["How much does Nanoplasty cost?", "Pricing starts from $280 and varies with hair length, thickness and product requirements. Your consultation confirms the most suitable option and final price."],
  ["How do I know which treatment is right for me?", "Start with a consultation. Rachel can assess your hair, listen to your desired finish and guide you toward the most suitable service."],
  ["How long will my appointment take?", "Appointment times vary by hair length, thickness and service. Esencia will confirm the expected time when your booking is arranged."],
  ["Should I wash my hair before my appointment?", "Preparation can vary by service. Please ask Esencia when booking so you receive the right advice for your appointment."],
];

export const galleryImages = [
  ["assets/images/editorial/dark-hair.webp", 1400, 1709, "Editorial portrait with softly layered dark hair", "Styling"],
  ["assets/images/editorial/silky-hair.webp", 1400, 934, "Long sleek dark hair", "Smoothing"],
  ["assets/images/editorial/long-hair.webp", 1400, 2100, "Long softly textured brunette hair", "Haircuts"],
  ["assets/images/editorial/consultation.webp", 1400, 934, "Stylist consultation in a bright salon", "Studio"],
  ["assets/images/editorial/glossy-hair.webp", 1400, 2101, "Long glossy brunette hair", "Nanoplasty"],
  ["assets/images/editorial/haircut.webp", 1400, 2100, "Hair being styled in a salon", "Styling"],
];
