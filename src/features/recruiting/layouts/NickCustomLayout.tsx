// src/features/recruiting/layouts/NickCustomLayout.tsx
// Custom layout for Nick Neessen's recruiting page - The Standard

import { useState, useEffect } from "react";
import { Instagram, Phone, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { LeadInterestForm } from "../components/public/LeadInterestForm";
import type { LayoutProps } from "./types";

export function NickCustomLayout({
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps) {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      duration: number;
      delay: number;
    }>
  >([]);

  const handleSuccess = (leadId: string) => {
    setFormSubmitted(true);
    onFormSuccess(leadId);
  };

  const accentColor = theme.accent_color || "#f59e0b";

  // Generate particles on mount
  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div
      className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#030303] text-white flex flex-col lg:flex-row relative"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {/* ===== ANIMATED BACKGROUND ===== */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 100% at 0% 0%, ${accentColor}15 0%, transparent 50%),
              radial-gradient(ellipse 80% 80% at 100% 100%, #6366f115 0%, transparent 50%),
              #030303
            `,
          }}
        />

        {/* Animated morphing blobs */}
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Gradient definitions */}
            <linearGradient
              id="blob1Gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient
              id="blob2Gradient"
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.1" />
            </linearGradient>
            <linearGradient
              id="blob3Gradient"
              x1="50%"
              y1="0%"
              x2="50%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
            </linearGradient>

            {/* Blur filter */}
            <filter id="blobBlur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="40" />
            </filter>
            <filter id="blobBlur2">
              <feGaussianBlur in="SourceGraphic" stdDeviation="60" />
            </filter>
          </defs>

          {/* Morphing blob 1 - large, top left */}
          <g filter="url(#blobBlur2)">
            <path
              fill="url(#blob1Gradient)"
              style={{ animation: "morphBlob1 25s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="25s"
                repeatCount="indefinite"
                values="
                  M-100,-50 C50,-150 200,-100 250,50 C300,200 200,350 50,300 C-100,250 -200,150 -100,-50 Z;
                  M-50,-100 C100,-200 300,-50 280,100 C260,250 100,400 -50,300 C-200,200 -150,0 -50,-100 Z;
                  M-150,0 C0,-200 250,-150 300,0 C350,150 250,350 50,350 C-150,350 -300,200 -150,0 Z;
                  M-100,-50 C50,-150 200,-100 250,50 C300,200 200,350 50,300 C-100,250 -200,150 -100,-50 Z
                "
              />
            </path>
          </g>

          {/* Morphing blob 2 - medium, right side */}
          <g
            filter="url(#blobBlur)"
            style={{ transform: "translate(60%, 30%)" }}
          >
            <path
              fill="url(#blob2Gradient)"
              style={{ animation: "morphBlob2 20s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="20s"
                repeatCount="indefinite"
                values="
                  M0,100 C80,0 200,20 250,120 C300,220 220,320 120,300 C20,280 -80,200 0,100 Z;
                  M20,80 C120,-20 240,40 280,140 C320,240 200,340 80,320 C-40,300 -60,180 20,80 Z;
                  M-20,120 C60,20 180,0 240,100 C300,200 240,320 140,340 C40,360 -100,260 -20,120 Z;
                  M0,100 C80,0 200,20 250,120 C300,220 220,320 120,300 C20,280 -80,200 0,100 Z
                "
              />
            </path>
          </g>

          {/* Morphing blob 3 - bottom */}
          <g
            filter="url(#blobBlur2)"
            style={{ transform: "translate(20%, 70%)" }}
          >
            <path
              fill="url(#blob3Gradient)"
              style={{ animation: "morphBlob3 30s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="30s"
                repeatCount="indefinite"
                values="
                  M50,50 C150,-50 300,0 350,100 C400,200 300,300 150,280 C0,260 -50,150 50,50 Z;
                  M30,80 C130,-40 320,30 380,130 C440,230 320,350 130,310 C-60,270 -70,200 30,80 Z;
                  M70,30 C170,-70 280,-20 340,80 C400,180 340,290 190,300 C40,310 -30,130 70,30 Z;
                  M50,50 C150,-50 300,0 350,100 C400,200 300,300 150,280 C0,260 -50,150 50,50 Z
                "
              />
            </path>
          </g>
        </svg>

        {/* Animated wave layers */}
        <div className="absolute inset-0 opacity-30">
          <svg
            className="absolute bottom-0 w-full h-[60%]"
            viewBox="0 0 1440 600"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Wave 1 */}
            <path
              fill="url(#waveGrad1)"
              style={{ animation: "wave1 12s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="12s"
                repeatCount="indefinite"
                values="
                  M0,300 C240,200 480,400 720,300 C960,200 1200,350 1440,280 L1440,600 L0,600 Z;
                  M0,350 C240,250 480,350 720,250 C960,150 1200,300 1440,350 L1440,600 L0,600 Z;
                  M0,280 C240,380 480,280 720,380 C960,280 1200,200 1440,300 L1440,600 L0,600 Z;
                  M0,300 C240,200 480,400 720,300 C960,200 1200,350 1440,280 L1440,600 L0,600 Z
                "
              />
            </path>
            {/* Wave 2 */}
            <path
              fill="url(#waveGrad2)"
              style={{ animation: "wave2 15s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="15s"
                repeatCount="indefinite"
                values="
                  M0,400 C320,300 640,450 960,350 C1280,250 1360,400 1440,380 L1440,600 L0,600 Z;
                  M0,350 C320,450 640,300 960,400 C1280,350 1360,300 1440,400 L1440,600 L0,600 Z;
                  M0,380 C320,280 640,400 960,300 C1280,400 1360,350 1440,350 L1440,600 L0,600 Z;
                  M0,400 C320,300 640,450 960,350 C1280,250 1360,400 1440,380 L1440,600 L0,600 Z
                "
              />
            </path>
          </svg>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background:
                  particle.id % 3 === 0
                    ? accentColor
                    : particle.id % 3 === 1
                      ? "#6366f1"
                      : "#8b5cf6",
                boxShadow: `0 0 ${particle.size * 4}px ${particle.id % 3 === 0 ? accentColor : particle.id % 3 === 1 ? "#6366f1" : "#8b5cf6"}`,
                animation: `floatParticle ${particle.duration}s ease-in-out infinite`,
                animationDelay: `${particle.delay}s`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>

        {/* Animated grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
          <defs>
            <pattern
              id="grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#grid)"
            style={{ animation: "gridShift 30s linear infinite" }}
          />
        </svg>

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Radial spotlight effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 50% 50% at 30% 50%, transparent 0%, #030303 100%)`,
          }}
        />
      </div>

      {/* ===== LEFT PANEL - Hero with content ===== */}
      <div className="w-full lg:w-[55%] xl:w-[58%] relative min-h-[50vh] md:min-h-[55vh] lg:h-screen z-10">
        {/* Hero image */}
        {theme.hero_image_url && (
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:bg-left"
              style={{ backgroundImage: `url(${theme.hero_image_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/70 via-[#030303]/30 to-[#030303] lg:hidden" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#030303]/50 via-transparent to-[#030303] hidden lg:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/30 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col p-5 pt-6 md:p-8 lg:p-10 xl:p-14">
          {/* Logo */}
          <div className="flex-shrink-0">
            {theme.logo_light_url ? (
              <img
                src={theme.logo_light_url}
                alt="The Standard"
                className="h-14 md:h-24 lg:h-44 xl:h-52 w-auto object-contain"
                style={{ filter: "drop-shadow(0 4px 30px rgba(0,0,0,0.5))" }}
              />
            ) : theme.logo_dark_url ? (
              <img
                src={theme.logo_dark_url}
                alt="The Standard"
                className="h-14 md:h-24 lg:h-44 xl:h-52 w-auto object-contain brightness-0 invert"
                style={{ filter: "drop-shadow(0 4px 30px rgba(0,0,0,0.5))" }}
              />
            ) : null}
          </div>

          <div className="flex-1 min-h-[20px] md:min-h-[40px]" />

          {/* Main content */}
          <div className="flex-shrink-0 space-y-3 md:space-y-5 lg:space-y-7">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-semibold tracking-wide uppercase border backdrop-blur-md"
              style={{
                background: `linear-gradient(135deg, ${accentColor}25 0%, rgba(99, 102, 241, 0.2) 100%)`,
                borderColor: `${accentColor}50`,
                color: accentColor,
                boxShadow: `0 0 30px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
              }}
            >
              <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
              Now Recruiting
            </div>

            {/* Headline */}
            <div className="space-y-2 md:space-y-4">
              <h1 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight">
                {theme.headline || "Join My Agency"}
              </h1>
              <p className="text-sm md:text-lg lg:text-xl xl:text-2xl text-white/80 leading-relaxed max-w-xl font-medium">
                {theme.subheadline ||
                  "Build a career with unlimited earning potential in the insurance industry."}
              </p>
            </div>

            {/* About */}
            <p className="text-white/50 leading-[1.75] text-sm lg:text-[15px] max-w-lg hidden md:block">
              {theme.about_text ||
                "I'm Nick Neessen, founder of The Standard. I've built a team of top-performing agents who are redefining what's possible in insurance sales. We provide world-class training, proven systems, and the support you need to succeed — whether you're new to the industry or a seasoned professional looking for the right opportunity."}
            </p>

            {/* CTA */}
            {theme.calendly_url && (
              <div className="pt-1 md:pt-2">
                <a
                  href={theme.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center gap-2 md:gap-3 px-5 py-3 md:px-7 md:py-4 rounded-xl font-bold text-sm md:text-base overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                    color: "#0a0a0a",
                    boxShadow: `0 0 40px ${accentColor}50, 0 8px 32px ${accentColor}30`,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.2) 100%)`,
                    }}
                  />
                  <Calendar className="w-4 h-4 md:w-5 md:h-5 relative z-10" />
                  <span className="relative z-10">
                    {theme.cta_text || "Schedule a Call"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            )}

            {/* Contact */}
            <div className="flex flex-wrap items-center gap-3 md:gap-5 pt-1">
              {theme.support_phone && (
                <a
                  href={`tel:${theme.support_phone}`}
                  className="group flex items-center gap-2 md:gap-3 text-white/40 hover:text-white transition-all duration-300"
                >
                  <div
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-all group-hover:scale-110"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                  <span className="text-xs md:text-sm font-medium">
                    {theme.support_phone}
                  </span>
                </a>
              )}
              {theme.social_links?.instagram && (
                <a
                  href={theme.social_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 md:gap-3 text-white/40 hover:text-white transition-all duration-300"
                >
                  <div
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-all group-hover:scale-110"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <Instagram className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                  <span className="text-xs md:text-sm font-medium">
                    @thestandard.hq
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL - Form ===== */}
      <div className="w-full lg:w-[45%] xl:w-[42%] min-h-[50vh] lg:h-screen relative z-10 pb-8 lg:pb-0">
        <div className="relative z-10 h-full flex items-start lg:items-center justify-center p-5 md:p-8 lg:p-10 pt-4 lg:pt-10">
          <div className="w-full max-w-md">
            {formSubmitted ? (
              <div
                className="rounded-2xl md:rounded-3xl p-8 md:p-10 text-center backdrop-blur-xl"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow:
                    "0 30px 100px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                <div
                  className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-xl md:rounded-2xl flex items-center justify-center mb-5 md:mb-6"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}40 0%, rgba(99, 102, 241, 0.3) 100%)`,
                    boxShadow: `0 0 60px ${accentColor}40`,
                  }}
                >
                  <svg
                    className="w-8 h-8 md:w-10 md:h-10"
                    fill="none"
                    stroke={accentColor}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-2 md:mb-3 tracking-tight">
                  You're In!
                </h3>
                <p className="text-v2-ink-subtle text-sm">
                  We'll be in touch within 24 hours.
                </p>
              </div>
            ) : (
              <div
                className="rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-9 backdrop-blur-xl"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow:
                    "0 30px 100px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                <div className="mb-5 md:mb-7">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-1.5 md:mb-2 tracking-tight">
                    Ready to Learn More?
                  </h2>
                  <p className="text-v2-ink-subtle text-xs md:text-sm">
                    Drop your info and I'll reach out personally.
                  </p>
                </div>
                <LeadInterestForm
                  recruiterSlug={recruiterId}
                  onSuccess={handleSuccess}
                  ctaText={theme.cta_text || "Submit"}
                  primaryColor={accentColor}
                  darkMode={true}
                />
              </div>
            )}

            {theme.disclaimer_text && (
              <p className="mt-4 md:mt-6 text-center text-[9px] md:text-[10px] text-v2-ink-muted leading-relaxed max-w-sm mx-auto px-2">
                {theme.disclaimer_text}
              </p>
            )}

            <p className="mt-5 md:mt-8 text-center text-[9px] md:text-[10px] text-v2-ink-muted tracking-wide">
              © {new Date().getFullYear()} The Standard. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ===== CSS ANIMATIONS ===== */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          25% { transform: translate(10px, -20px) scale(1.2); opacity: 0.8; }
          50% { transform: translate(-5px, -40px) scale(0.8); opacity: 0.4; }
          75% { transform: translate(15px, -20px) scale(1.1); opacity: 0.7; }
        }
        @keyframes gridShift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }
      `}</style>
    </div>
  );
}

export default NickCustomLayout;
