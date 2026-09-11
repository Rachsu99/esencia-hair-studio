export const priceDefinitions = [
  { key: "haircuts-ladies", category: "Haircuts", service: "haircuts", index: 0, label: "Ladies Haircut", amountCents: 8500, displayType: "fixed", sortOrder: 10 },
  { key: "haircuts-treatment", category: "Haircuts", service: "haircuts", index: 1, label: "Shampoo, Treatment & Haircut", amountCents: 9500, displayType: "fixed", sortOrder: 20 },
  { key: "keratin-short", category: "Keratin", service: "keratin", index: 0, label: "Short Hair", amountCents: 18000, displayType: "from", sortOrder: 30 },
  { key: "keratin-medium", category: "Keratin", service: "keratin", index: 1, label: "Medium Hair", amountCents: 23000, displayType: "from", sortOrder: 40 },
  { key: "keratin-long", category: "Keratin", service: "keratin", index: 2, label: "Long Hair", amountCents: 28000, displayType: "from", sortOrder: 50 },
  { key: "keratin-extra-long-thick", category: "Keratin", service: "keratin", index: 3, label: "Extra Long / Thick Hair", amountCents: 33000, displayType: "from", sortOrder: 60 },
  { key: "nanoplasty-short", category: "Nanoplasty", service: "nanoplasty", index: 0, label: "Short Hair", amountCents: 28000, displayType: "from", sortOrder: 70 },
  { key: "nanoplasty-medium", category: "Nanoplasty", service: "nanoplasty", index: 1, label: "Medium Hair", amountCents: 34000, displayType: "from", sortOrder: 80 },
  { key: "nanoplasty-long", category: "Nanoplasty", service: "nanoplasty", index: 2, label: "Long Hair", amountCents: 40000, displayType: "from", sortOrder: 90 },
  { key: "nanoplasty-extra-long-thick", category: "Nanoplasty", service: "nanoplasty", index: 3, label: "Extra Long / Thick Hair", amountCents: 55000, displayType: "from", sortOrder: 100 },
  { key: "extensions-tape", category: "Hair Extensions", service: "hair-extensions", index: 0, label: "Tape Extensions", amountCents: null, displayType: "consultation", sortOrder: 110 },
  { key: "extensions-k-tip", category: "Hair Extensions", service: "hair-extensions", index: 1, label: "K-Tip Extensions", amountCents: null, displayType: "consultation", sortOrder: 120 },
  { key: "removal-tape", category: "Extension Removal", service: "extension-removal", index: 0, label: "Tape Extension Removal", amountCents: 6000, displayType: "from", sortOrder: 130 },
  { key: "removal-k-tip", category: "Extension Removal", service: "extension-removal", index: 1, label: "K-Tip Extension Removal", amountCents: 10000, displayType: "from", sortOrder: 140 },
  { key: "styling-blow-dry", category: "Styling", service: "styling", index: 0, label: "Shampoo & Blow-Dry", amountCents: 5500, displayType: "fixed", sortOrder: 150 },
  { key: "styling-dry-style", category: "Styling", service: "styling", index: 1, label: "Dry Style – Curls & Waves", amountCents: 4500, displayType: "fixed", sortOrder: 160 },
  { key: "styling-extra-long-thick", category: "Styling", service: "styling", index: null, label: "Extra Long / Thick Hair", amountCents: 1000, displayType: "surcharge", sortOrder: 170 },
];

export const startingPriceKeys = {
  haircuts: "haircuts-ladies",
  keratin: "keratin-short",
  nanoplasty: "nanoplasty-short",
  "hair-extensions": "extensions-tape",
  "extension-removal": "removal-tape",
  styling: "styling-dry-style",
};

export const priceKeyFor = (service, index) =>
  priceDefinitions.find((item) => item.service === service && item.index === index)?.key || "";

export const formatPrice = (amountCents, displayType) => {
  if (displayType === "consultation") return "Price on Consultation";
  const amount = Number(amountCents);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError("A valid price in cents is required.");
  const dollars = amount / 100;
  const number = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  if (displayType === "from") return `from $${number}`;
  if (displayType === "surcharge") return `+$${number}`;
  if (displayType === "fixed") return `$${number}`;
  throw new TypeError("Unknown price display type.");
};
