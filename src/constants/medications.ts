// src/constants/medications.ts
// A SIMPLE, non-clinical list of common medications grouped by what they treat (condition) and the
// organ/system they relate to — for the inbound intake's quick "what are they taking?" checkboxes.
// Intentionally not exhaustive or scientific (per owner): just the common names agents hear on calls.
// The underwriting wizard's MEDICATION_CATEGORIES is a different thing (boolean/count underwriting
// flags, no drug names), so this is a separate, purpose-built list — not a duplicate of it.

export interface MedicationGroup {
  id: string;
  condition: string; // what it's for
  organ: string; // plain-English system label
  meds: string[];
}

export const COMMON_MEDICATIONS: MedicationGroup[] = [
  {
    id: "blood_pressure",
    condition: "Blood Pressure",
    organ: "Heart",
    meds: [
      "Lisinopril",
      "Amlodipine",
      "Losartan",
      "Metoprolol",
      "Hydrochlorothiazide",
    ],
  },
  {
    id: "cholesterol",
    condition: "Cholesterol",
    organ: "Heart",
    meds: [
      "Atorvastatin (Lipitor)",
      "Rosuvastatin (Crestor)",
      "Simvastatin",
      "Pravastatin",
    ],
  },
  {
    id: "blood_thinners",
    condition: "Blood Thinners",
    organ: "Heart",
    meds: [
      "Eliquis",
      "Xarelto",
      "Warfarin (Coumadin)",
      "Plavix",
      "Aspirin (low-dose)",
    ],
  },
  {
    id: "diabetes",
    condition: "Diabetes",
    organ: "Pancreas",
    meds: [
      "Metformin",
      "Insulin (Lantus)",
      "Ozempic",
      "Jardiance",
      "Glipizide",
    ],
  },
  {
    id: "asthma_copd",
    condition: "Asthma / COPD",
    organ: "Lungs",
    meds: ["Albuterol inhaler", "Advair", "Symbicort", "Singulair", "Spiriva"],
  },
  {
    id: "thyroid",
    condition: "Thyroid",
    organ: "Thyroid",
    meds: ["Levothyroxine (Synthroid)", "Armour Thyroid"],
  },
  {
    id: "kidney",
    condition: "Kidney / Fluid",
    organ: "Kidney",
    meds: ["Furosemide (Lasix)", "Spironolactone"],
  },
  {
    id: "acid_reflux",
    condition: "Acid Reflux",
    organ: "Stomach",
    meds: ["Omeprazole (Prilosec)", "Pantoprazole", "Famotidine"],
  },
  {
    id: "mental_health",
    condition: "Mental Health",
    organ: "Brain",
    meds: [
      "Sertraline (Zoloft)",
      "Escitalopram (Lexapro)",
      "Bupropion (Wellbutrin)",
      "Alprazolam (Xanax)",
    ],
  },
  {
    id: "pain",
    condition: "Pain / Nerve",
    organ: "General",
    meds: ["Gabapentin", "Tramadol", "Hydrocodone", "Ibuprofen (Rx)"],
  },
];

// Friendly policy-type labels for the "existing coverage" capture (free-form, stored in jsonb —
// not the products enum, so "Final Expense" is fine here).
export const COVERAGE_POLICY_TYPES: string[] = [
  "Final Expense",
  "Term Life",
  "Whole Life",
  "Participating Whole Life",
  "Universal Life",
  "Indexed Universal Life (IUL)",
  "Annuity",
  "Other",
];
