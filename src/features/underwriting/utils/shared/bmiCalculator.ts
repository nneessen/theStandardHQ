// src/features/underwriting/utils/bmiCalculator.ts

/**
 * Calculate BMI from height and weight
 * Formula: (weight in lbs × 703) / (height in inches)²
 */
export function calculateBMI(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
): number {
  const totalInches = heightFeet * 12 + heightInches;
  if (totalInches <= 0 || weightLbs <= 0) return 0;
  return (
    Math.round(((weightLbs * 703) / (totalInches * totalInches)) * 10) / 10
  );
}

/**
 * Get BMI category based on value
 */
export function getBMICategory(bmi: number): string {
  if (bmi <= 0) return "Unknown";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obese Class I";
  if (bmi < 40) return "Obese Class II";
  return "Obese Class III";
}

/**
 * Get BMI risk level for underwriting
 */
export function getBMIRiskLevel(
  bmi: number,
): "low" | "moderate" | "high" | "very_high" {
  if (bmi >= 18.5 && bmi < 25) return "low";
  if (bmi >= 25 && bmi < 30) return "moderate";
  if (bmi >= 30 && bmi < 35) return "high";
  return "very_high";
}

/**
 * Convert height in total inches to feet and inches
 */
export function inchesToFeetAndInches(totalInches: number): {
  feet: number;
  inches: number;
} {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

/**
 * Convert height in feet and inches to total inches
 */
export function feetAndInchesToInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}

/**
 * Format height for display
 */
export function formatHeight(feet: number, inches: number): string {
  return `${feet}'${inches}"`;
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string | Date): number {
  const birthDate = typeof dob === "string" ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}
