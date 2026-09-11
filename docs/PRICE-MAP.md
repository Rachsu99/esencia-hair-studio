# Esencia service price map

All monetary amounts are stored as integer cents. The display type controls formatting; the administrator edits only numeric amounts.

| Price key | Category / label | Current value | Type | Public consumers |
| --- | --- | ---: | --- | --- |
| `haircuts-ladies` | Haircuts / Ladies Haircut | $85 | fixed | Homepage service card; Services price list; Haircuts page; Haircuts structured data |
| `haircuts-treatment` | Haircuts / Shampoo, Treatment & Haircut | $95 | fixed | Services price list; Haircuts page; Haircuts FAQ; Haircuts structured data |
| `keratin-short` | Keratin / Short Hair | from $180 | from | Homepage service card, comparison and booking FAQ; Services price list and comparison; Keratin page; Keratin structured data |
| `keratin-medium` | Keratin / Medium Hair | from $230 | from | Services price list; Keratin page; Keratin structured data |
| `keratin-long` | Keratin / Long Hair | from $280 | from | Services price list; Keratin page; Keratin structured data |
| `keratin-extra-long-thick` | Keratin / Extra Long / Thick Hair | from $330 | from | Services price list; Keratin page; Keratin structured data |
| `nanoplasty-short` | Nanoplasty / Short Hair | from $280 | from | Homepage service card and comparison; Services price list and comparison; Nanoplasty page; Nanoplasty structured data |
| `nanoplasty-medium` | Nanoplasty / Medium Hair | from $340 | from | Services price list; Nanoplasty page; Nanoplasty structured data |
| `nanoplasty-long` | Nanoplasty / Long Hair | from $400 | from | Services price list; Nanoplasty page; Nanoplasty structured data |
| `nanoplasty-extra-long-thick` | Nanoplasty / Extra Long / Thick Hair | from $550 | from | Services price list; Nanoplasty page; Nanoplasty structured data |
| `extensions-tape` | Hair Extensions / Tape Extensions | Price on Consultation | consultation | Homepage service card; Services price list; Hair Extensions page; Hair Extensions structured data |
| `extensions-k-tip` | Hair Extensions / K-Tip Extensions | Price on Consultation | consultation | Services price list; Hair Extensions page; Hair Extensions structured data |
| `removal-tape` | Extension Removal / Tape Extension Removal | from $60 | from | Homepage service card; Services price list; Extension Removal page and FAQ; Extension Removal structured data |
| `removal-k-tip` | Extension Removal / K-Tip Extension Removal | from $100 | from | Services price list; Extension Removal page and FAQ; Extension Removal structured data |
| `styling-blow-dry` | Styling / Shampoo & Blow-Dry | $55 | fixed | Services price list; Styling page; Styling structured data |
| `styling-dry-style` | Styling / Dry Style – Curls & Waves | $45 | fixed | Homepage service card; Services price list; Styling page; Styling structured data |
| `styling-extra-long-thick` | Styling / Extra Long / Thick Hair | +$10 | surcharge | Styling price note (`+$10`); Styling FAQ (`$10` in the existing “additional” sentence) |

The static value remains inside each public price element as the failure-safe fallback. D1 replaces it at the edge only when a valid row is available.
