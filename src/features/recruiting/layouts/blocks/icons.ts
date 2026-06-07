// src/features/recruiting/layouts/blocks/icons.ts
// Fixed allowlist → lucide-react component map. The design spec can only
// reference an icon by one of these keys (enforced by validateDesignSpec); an
// unknown key is dropped, so no arbitrary component can ever be rendered.

import {
  Cpu,
  Network,
  Shield,
  Sparkles,
  ArrowRight,
  Phone,
  Instagram,
  DollarSign,
  BookOpen,
  Clock,
  Rocket,
  Users,
  MapPin,
  Zap,
  TrendingUp,
  Award,
  Check,
  Star,
  Briefcase,
  Target,
  Heart,
  GraduationCap,
  Handshake,
  LineChart,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import type { SpecIcon } from "@/types/recruiting-design-spec.types";

export const ICON_MAP: Record<SpecIcon, LucideIcon> = {
  cpu: Cpu,
  network: Network,
  shield: Shield,
  sparkles: Sparkles,
  "arrow-right": ArrowRight,
  phone: Phone,
  instagram: Instagram,
  "dollar-sign": DollarSign,
  "book-open": BookOpen,
  clock: Clock,
  rocket: Rocket,
  users: Users,
  "map-pin": MapPin,
  zap: Zap,
  "trending-up": TrendingUp,
  award: Award,
  check: Check,
  star: Star,
  briefcase: Briefcase,
  target: Target,
  heart: Heart,
  "graduation-cap": GraduationCap,
  handshake: Handshake,
  "line-chart": LineChart,
  "badge-check": BadgeCheck,
};

/** Returns the lucide component for an allowlisted icon, or null. */
export function resolveIcon(icon: SpecIcon | undefined): LucideIcon | null {
  if (!icon) return null;
  return ICON_MAP[icon] ?? null;
}
