// src/features/settings/landing-page/LandingPageSettingsTab.tsx
// Main landing page settings editor

import { useState, useEffect } from "react";
import {
  Palette,
  Layout,
  BarChart3,
  Users,
  Image,
  TrendingUp,
  CheckSquare,
  Cpu,
  Quote,
  HelpCircle,
  Megaphone,
  Globe,
  Save,
  RotateCcw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useImo } from "@/hooks/imo";
import {
  useLandingPageOperations,
  DEFAULT_LANDING_PAGE_THEME,
} from "@/features/landing";
import type {
  LandingPageSettingsInput,
  LandingPageTheme,
  StatItem,
  FaqItem,
  Testimonial,
  OpportunityStep,
  RequirementItem,
  TechFeature,
  GalleryImage,
} from "@/features/landing";

// Section config for the sidebar
const SECTIONS = [
  { id: "theme", label: "Theme", icon: Palette },
  { id: "hero", label: "Hero", icon: Layout },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "about", label: "About", icon: Users },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "opportunity", label: "Opportunity", icon: TrendingUp },
  { id: "requirements", label: "Requirements", icon: CheckSquare },
  { id: "tech", label: "Tech", icon: Cpu },
  { id: "testimonials", label: "Testimonials", icon: Quote },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "final_cta", label: "Final CTA", icon: Megaphone },
  { id: "seo", label: "SEO & Contact", icon: Globe },
] as const;

type SectionType = (typeof SECTIONS)[number]["id"];

export function LandingPageSettingsTab() {
  const { imo } = useImo();
  const imoId = imo?.id || "";

  const { settings, isLoading, save, reset, isSaving, isResetting } =
    useLandingPageOperations(imoId);

  // Local form state
  const [formData, setFormData] = useState<LandingPageSettingsInput>({});
  const [activeSection, setActiveSection] = useState<SectionType>("theme");
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data from settings or defaults
  useEffect(() => {
    if (settings) {
      // Convert LandingPageSettingsRow to LandingPageSettingsInput
      // by spreading and letting TypeScript handle the conversion
      const { id, imo_id, created_at, updated_at, ...settingsInput } = settings;
      setFormData(settingsInput as LandingPageSettingsInput);
      setHasChanges(false);
    } else {
      // Use defaults when no settings exist
      setFormData(DEFAULT_LANDING_PAGE_THEME as LandingPageSettingsInput);
      setHasChanges(false);
    }
  }, [settings]);

  // Update form field
  const updateField = <K extends keyof LandingPageSettingsInput>(
    field: K,
    value: LandingPageSettingsInput[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Save handler
  const handleSave = async () => {
    try {
      await save(formData);
      setHasChanges(false);
    } catch (_error) {
      // Error handled by mutation
    }
  };

  // Reset handler
  const handleReset = async () => {
    if (
      confirm(
        "Reset all landing page settings to defaults? This cannot be undone.",
      )
    ) {
      try {
        await reset();
        setHasChanges(false);
      } catch (_error) {
        // Error handled by mutation
      }
    }
  };

  // Preview handler
  const handlePreview = () => {
    window.open("/landing", "_blank");
  };

  if (!imoId) {
    return (
      <div className="flex items-center justify-center h-64 text-v2-ink-muted">
        No IMO selected. Please select an IMO to manage landing page settings.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-v2-ink-muted">
        Loading settings...
      </div>
    );
  }

  // Get current values with defaults
  const currentTheme: LandingPageTheme = {
    ...DEFAULT_LANDING_PAGE_THEME,
    ...formData,
  } as LandingPageTheme;

  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-v2-ring bg-v2-card">
        <div>
          <h2 className="text-sm font-semibold text-v2-ink">
            Landing Page Settings
          </h2>
          <p className="text-xs text-v2-ink-muted">
            Customize your public recruiting landing page
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isResetting}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="text-xs"
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar navigation */}
        <div className="w-48 border-r border-v2-ring bg-v2-canvas dark:bg-v2-card/50">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      isActive
                        ? "bg-v2-card text-v2-ink shadow-sm"
                        : "text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-card/50 dark:hover:bg-v2-card-tinted/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {section.label}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {activeSection === "theme" && (
                <ThemeSection theme={currentTheme} updateField={updateField} />
              )}
              {activeSection === "hero" && (
                <HeroSection theme={currentTheme} updateField={updateField} />
              )}
              {activeSection === "stats" && (
                <StatsSection theme={currentTheme} updateField={updateField} />
              )}
              {activeSection === "about" && (
                <AboutSection theme={currentTheme} updateField={updateField} />
              )}
              {activeSection === "gallery" && (
                <GallerySection
                  theme={currentTheme}
                  updateField={updateField}
                />
              )}
              {activeSection === "opportunity" && (
                <OpportunitySection
                  theme={currentTheme}
                  updateField={updateField}
                />
              )}
              {activeSection === "requirements" && (
                <RequirementsSection
                  theme={currentTheme}
                  updateField={updateField}
                />
              )}
              {activeSection === "tech" && (
                <TechSection theme={currentTheme} updateField={updateField} />
              )}
              {activeSection === "testimonials" && (
                <TestimonialsSection
                  theme={currentTheme}
                  updateField={updateField}
                />
              )}
              {activeSection === "faq" && (
                <FaqSection theme={currentTheme} updateField={updateField} />
              )}
              {activeSection === "final_cta" && (
                <FinalCtaSection
                  theme={currentTheme}
                  updateField={updateField}
                />
              )}
              {activeSection === "seo" && (
                <SeoContactSection
                  theme={currentTheme}
                  updateField={updateField}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// ===== SECTION COMPONENTS =====

interface SectionProps {
  theme: LandingPageTheme;
  updateField: <K extends keyof LandingPageSettingsInput>(
    field: K,
    value: LandingPageSettingsInput[K],
  ) => void;
}

// Theme Section
function ThemeSection({ theme, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">Brand Colors</h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          Define the color palette for your landing page
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Primary Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primary_color}
                onChange={(e) => updateField("primary_color", e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Input
                value={theme.primary_color}
                onChange={(e) => updateField("primary_color", e.target.value)}
                placeholder="#f59e0b"
                className="text-xs h-8"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Secondary Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.secondary_color}
                onChange={(e) => updateField("secondary_color", e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Input
                value={theme.secondary_color}
                onChange={(e) => updateField("secondary_color", e.target.value)}
                placeholder="#18181b"
                className="text-xs h-8"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Accent Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.accent_color}
                onChange={(e) => updateField("accent_color", e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Input
                value={theme.accent_color}
                onChange={(e) => updateField("accent_color", e.target.value)}
                placeholder="#6366f1"
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">Logo</h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          Upload your logo for light and dark backgrounds
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Light Background Logo URL</Label>
            <Input
              value={theme.logo_light_url || ""}
              onChange={(e) =>
                updateField("logo_light_url", e.target.value || null)
              }
              placeholder="https://..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Dark Background Logo URL</Label>
            <Input
              value={theme.logo_dark_url || ""}
              onChange={(e) =>
                updateField("logo_dark_url", e.target.value || null)
              }
              placeholder="https://..."
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">Login Access</h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          How should users access the login page from the landing page?
        </p>
        <div className="space-y-2">
          <Label className="text-xs">Access Type</Label>
          <select
            value={theme.login_access_type}
            onChange={(e) =>
              updateField("login_access_type", e.target.value as any)
            }
            className="w-full h-8 px-2 text-xs border rounded-md bg-v2-card"
          >
            <option value="easter_egg">Easter Egg (Hidden)</option>
            <option value="footer_link">Footer Link</option>
            <option value="nav_button">Navigation Button</option>
            <option value="both">Both Footer & Navigation</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Hero Section
function HeroSection({ theme, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">Hero Content</h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          The main headline and call-to-action
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.hero_headline}
              onChange={(e) => updateField("hero_headline", e.target.value)}
              placeholder="Build Your Future"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Textarea
              value={theme.hero_subheadline}
              onChange={(e) => updateField("hero_subheadline", e.target.value)}
              placeholder="Remote sales careers for the ambitious"
              className="text-xs min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">CTA Button Text</Label>
              <Input
                value={theme.hero_cta_text}
                onChange={(e) => updateField("hero_cta_text", e.target.value)}
                placeholder="Start Your Journey"
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">CTA Link</Label>
              <Input
                value={theme.hero_cta_link}
                onChange={(e) => updateField("hero_cta_link", e.target.value)}
                placeholder="/join"
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">
          Background Media
        </h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          Optional video or image for the hero background
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Video URL</Label>
            <Input
              value={theme.hero_video_url || ""}
              onChange={(e) =>
                updateField("hero_video_url", e.target.value || null)
              }
              placeholder="https://..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Image URL (fallback)</Label>
            <Input
              value={theme.hero_image_url || ""}
              onChange={(e) =>
                updateField("hero_image_url", e.target.value || null)
              }
              placeholder="https://..."
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats Section
function StatsSection({ theme, updateField }: SectionProps) {
  const updateStat = (index: number, field: keyof StatItem, value: string) => {
    const newStats = [...theme.stats_data];
    newStats[index] = { ...newStats[index], [field]: value };
    updateField("stats_data", newStats);
  };

  const addStat = () => {
    updateField("stats_data", [
      ...theme.stats_data,
      { label: "New Stat", value: "0", prefix: "", suffix: "" },
    ]);
  };

  const removeStat = (index: number) => {
    updateField(
      "stats_data",
      theme.stats_data.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Stats Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Key metrics displayed below the hero
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.stats_enabled}
            onCheckedChange={(checked) => updateField("stats_enabled", checked)}
          />
        </div>
      </div>

      {theme.stats_enabled && (
        <div className="space-y-3">
          {theme.stats_data.map((stat, index) => (
            <div
              key={index}
              className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-v2-ink-muted">
                  Stat {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStat(index)}
                  className="h-6 text-xs text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Prefix</Label>
                  <Input
                    value={stat.prefix || ""}
                    onChange={(e) =>
                      updateStat(index, "prefix", e.target.value)
                    }
                    placeholder="$"
                    className="text-xs h-7"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Value</Label>
                  <Input
                    value={stat.value}
                    onChange={(e) => updateStat(index, "value", e.target.value)}
                    placeholder="75000"
                    className="text-xs h-7"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Suffix</Label>
                  <Input
                    value={stat.suffix || ""}
                    onChange={(e) =>
                      updateStat(index, "suffix", e.target.value)
                    }
                    placeholder="+"
                    className="text-xs h-7"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Label</Label>
                  <Input
                    value={stat.label}
                    onChange={(e) => updateStat(index, "label", e.target.value)}
                    placeholder="Average First Year"
                    className="text-xs h-7"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addStat}
            className="w-full text-xs"
          >
            Add Stat
          </Button>
        </div>
      )}
    </div>
  );
}

// About Section
function AboutSection({ theme, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            About Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Tell your story and mission
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.about_enabled}
            onCheckedChange={(checked) => updateField("about_enabled", checked)}
          />
        </div>
      </div>

      {theme.about_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.about_headline}
              onChange={(e) => updateField("about_headline", e.target.value)}
              placeholder="Who We Are"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Content</Label>
            <Textarea
              value={theme.about_content}
              onChange={(e) => updateField("about_content", e.target.value)}
              placeholder="We are a team of driven professionals..."
              className="text-xs min-h-[120px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Video URL</Label>
              <Input
                value={theme.about_video_url || ""}
                onChange={(e) =>
                  updateField("about_video_url", e.target.value || null)
                }
                placeholder="https://..."
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Image URL</Label>
              <Input
                value={theme.about_image_url || ""}
                onChange={(e) =>
                  updateField("about_image_url", e.target.value || null)
                }
                placeholder="https://..."
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Gallery Section
function GallerySection({ theme, updateField }: SectionProps) {
  const addImage = () => {
    updateField("gallery_images", [
      ...theme.gallery_images,
      { url: "", caption: "", alt: "" },
    ]);
  };

  const updateImage = (
    index: number,
    field: keyof GalleryImage,
    value: string,
  ) => {
    const newImages = [...theme.gallery_images];
    newImages[index] = { ...newImages[index], [field]: value };
    updateField("gallery_images", newImages);
  };

  const removeImage = (index: number) => {
    updateField(
      "gallery_images",
      theme.gallery_images.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Gallery Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Showcase your team culture with photos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.gallery_enabled}
            onCheckedChange={(checked) =>
              updateField("gallery_enabled", checked)
            }
          />
        </div>
      </div>

      {theme.gallery_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.gallery_headline}
              onChange={(e) => updateField("gallery_headline", e.target.value)}
              placeholder="Our People"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Input
              value={theme.gallery_subheadline}
              onChange={(e) =>
                updateField("gallery_subheadline", e.target.value)
              }
              placeholder="The culture that drives our success"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Featured Image URL</Label>
            <Input
              value={theme.gallery_featured_url || ""}
              onChange={(e) =>
                updateField("gallery_featured_url", e.target.value || null)
              }
              placeholder="https://..."
              className="text-xs h-8"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs">Gallery Images</Label>
            {theme.gallery_images.map((image, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-v2-ink-muted">
                    Image {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">URL</Label>
                    <Input
                      value={image.url}
                      onChange={(e) =>
                        updateImage(index, "url", e.target.value)
                      }
                      placeholder="https://..."
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Caption</Label>
                    <Input
                      value={image.caption || ""}
                      onChange={(e) =>
                        updateImage(index, "caption", e.target.value)
                      }
                      placeholder="Optional caption"
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Alt Text</Label>
                    <Input
                      value={image.alt || ""}
                      onChange={(e) =>
                        updateImage(index, "alt", e.target.value)
                      }
                      placeholder="Image description"
                      className="text-xs h-7"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addImage}
              className="w-full text-xs"
            >
              Add Image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Opportunity Section
function OpportunitySection({ theme, updateField }: SectionProps) {
  const addStep = () => {
    updateField("opportunity_steps", [
      ...theme.opportunity_steps,
      { title: "New Step", description: "", icon: "rocket", detail: "" },
    ]);
  };

  const updateStep = (
    index: number,
    field: keyof OpportunityStep,
    value: string,
  ) => {
    const newSteps = [...theme.opportunity_steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    updateField("opportunity_steps", newSteps);
  };

  const removeStep = (index: number) => {
    updateField(
      "opportunity_steps",
      theme.opportunity_steps.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Opportunity Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Show the career path and progression
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.opportunity_enabled}
            onCheckedChange={(checked) =>
              updateField("opportunity_enabled", checked)
            }
          />
        </div>
      </div>

      {theme.opportunity_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.opportunity_headline}
              onChange={(e) =>
                updateField("opportunity_headline", e.target.value)
              }
              placeholder="Your Path"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Input
              value={theme.opportunity_subheadline}
              onChange={(e) =>
                updateField("opportunity_subheadline", e.target.value)
              }
              placeholder="From day one to agency ownership"
              className="text-xs h-8"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs">Steps</Label>
            {theme.opportunity_steps.map((step, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-v2-ink-muted">
                    Step {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(index)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Title</Label>
                    <Input
                      value={step.title}
                      onChange={(e) =>
                        updateStep(index, "title", e.target.value)
                      }
                      placeholder="Join"
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Icon</Label>
                    <Input
                      value={step.icon}
                      onChange={(e) =>
                        updateStep(index, "icon", e.target.value)
                      }
                      placeholder="rocket"
                      className="text-xs h-7"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Description</Label>
                  <Input
                    value={step.description}
                    onChange={(e) =>
                      updateStep(index, "description", e.target.value)
                    }
                    placeholder="Apply and complete onboarding"
                    className="text-xs h-7"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Detail</Label>
                  <Input
                    value={step.detail || ""}
                    onChange={(e) =>
                      updateStep(index, "detail", e.target.value)
                    }
                    placeholder="Get licensed and certified"
                    className="text-xs h-7"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addStep}
              className="w-full text-xs"
            >
              Add Step
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Requirements Section
function RequirementsSection({ theme, updateField }: SectionProps) {
  const addItem = () => {
    updateField("requirements_items", [
      ...theme.requirements_items,
      { trait: "New Trait", description: "", icon: "check" },
    ]);
  };

  const updateItem = (
    index: number,
    field: keyof RequirementItem,
    value: string,
  ) => {
    const newItems = [...theme.requirements_items];
    newItems[index] = { ...newItems[index], [field]: value };
    updateField("requirements_items", newItems);
  };

  const removeItem = (index: number) => {
    updateField(
      "requirements_items",
      theme.requirements_items.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Requirements Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            What traits you're looking for in candidates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.requirements_enabled}
            onCheckedChange={(checked) =>
              updateField("requirements_enabled", checked)
            }
          />
        </div>
      </div>

      {theme.requirements_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.requirements_headline}
              onChange={(e) =>
                updateField("requirements_headline", e.target.value)
              }
              placeholder="What It Takes"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Input
              value={theme.requirements_subheadline}
              onChange={(e) =>
                updateField("requirements_subheadline", e.target.value)
              }
              placeholder="No experience required. Just the right mindset."
              className="text-xs h-8"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs">Requirements</Label>
            {theme.requirements_items.map((item, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-v2-ink-muted">
                    Requirement {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Trait</Label>
                    <Input
                      value={item.trait}
                      onChange={(e) =>
                        updateItem(index, "trait", e.target.value)
                      }
                      placeholder="Self-Motivated"
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Icon</Label>
                    <Input
                      value={item.icon}
                      onChange={(e) =>
                        updateItem(index, "icon", e.target.value)
                      }
                      placeholder="flame"
                      className="text-xs h-7"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    placeholder="You don't wait to be told what to do"
                    className="text-xs h-7"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addItem}
              className="w-full text-xs"
            >
              Add Requirement
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Tech Section
function TechSection({ theme, updateField }: SectionProps) {
  const addFeature = () => {
    updateField("tech_features", [
      ...theme.tech_features,
      { title: "New Feature", description: "", icon: "cpu" },
    ]);
  };

  const updateFeature = (
    index: number,
    field: keyof TechFeature,
    value: string,
  ) => {
    const newFeatures = [...theme.tech_features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    updateField("tech_features", newFeatures);
  };

  const removeFeature = (index: number) => {
    updateField(
      "tech_features",
      theme.tech_features.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Tech Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Showcase your technology and tools
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.tech_enabled}
            onCheckedChange={(checked) => updateField("tech_enabled", checked)}
          />
        </div>
      </div>

      {theme.tech_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.tech_headline}
              onChange={(e) => updateField("tech_headline", e.target.value)}
              placeholder="Your Tools"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Input
              value={theme.tech_subheadline}
              onChange={(e) => updateField("tech_subheadline", e.target.value)}
              placeholder="Built for the digital generation"
              className="text-xs h-8"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs">Features</Label>
            {theme.tech_features.map((feature, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-v2-ink-muted">
                    Feature {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFeature(index)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Title</Label>
                    <Input
                      value={feature.title}
                      onChange={(e) =>
                        updateFeature(index, "title", e.target.value)
                      }
                      placeholder="Smart Dashboard"
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Icon</Label>
                    <Input
                      value={feature.icon}
                      onChange={(e) =>
                        updateFeature(index, "icon", e.target.value)
                      }
                      placeholder="chart"
                      className="text-xs h-7"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Description</Label>
                  <Input
                    value={feature.description}
                    onChange={(e) =>
                      updateFeature(index, "description", e.target.value)
                    }
                    placeholder="Real-time performance tracking"
                    className="text-xs h-7"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addFeature}
              className="w-full text-xs"
            >
              Add Feature
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Testimonials Section
function TestimonialsSection({ theme, updateField }: SectionProps) {
  const addTestimonial = () => {
    updateField("testimonials", [
      ...theme.testimonials,
      {
        name: "",
        role: "",
        quote: "",
        image_url: "",
        video_url: "",
        earnings: "",
      },
    ]);
  };

  const updateTestimonial = (
    index: number,
    field: keyof Testimonial,
    value: string,
  ) => {
    const newTestimonials = [...theme.testimonials];
    newTestimonials[index] = { ...newTestimonials[index], [field]: value };
    updateField("testimonials", newTestimonials);
  };

  const removeTestimonial = (index: number) => {
    updateField(
      "testimonials",
      theme.testimonials.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Testimonials Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Real stories from your agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.testimonials_enabled}
            onCheckedChange={(checked) =>
              updateField("testimonials_enabled", checked)
            }
          />
        </div>
      </div>

      {theme.testimonials_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.testimonials_headline}
              onChange={(e) =>
                updateField("testimonials_headline", e.target.value)
              }
              placeholder="Real Stories"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Input
              value={theme.testimonials_subheadline}
              onChange={(e) =>
                updateField("testimonials_subheadline", e.target.value)
              }
              placeholder="From our agents"
              className="text-xs h-8"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs">Testimonials</Label>
            {theme.testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-v2-ink-muted">
                    Testimonial {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTestimonial(index)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Name</Label>
                    <Input
                      value={testimonial.name}
                      onChange={(e) =>
                        updateTestimonial(index, "name", e.target.value)
                      }
                      placeholder="John Smith"
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Role</Label>
                    <Input
                      value={testimonial.role || ""}
                      onChange={(e) =>
                        updateTestimonial(index, "role", e.target.value)
                      }
                      placeholder="Senior Agent"
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Earnings</Label>
                    <Input
                      value={testimonial.earnings || ""}
                      onChange={(e) =>
                        updateTestimonial(index, "earnings", e.target.value)
                      }
                      placeholder="$150k first year"
                      className="text-xs h-7"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Quote</Label>
                  <Textarea
                    value={testimonial.quote}
                    onChange={(e) =>
                      updateTestimonial(index, "quote", e.target.value)
                    }
                    placeholder="This opportunity changed my life..."
                    className="text-xs min-h-[60px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Photo URL</Label>
                    <Input
                      value={testimonial.image_url || ""}
                      onChange={(e) =>
                        updateTestimonial(index, "image_url", e.target.value)
                      }
                      placeholder="https://..."
                      className="text-xs h-7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Video URL</Label>
                    <Input
                      value={testimonial.video_url || ""}
                      onChange={(e) =>
                        updateTestimonial(index, "video_url", e.target.value)
                      }
                      placeholder="https://..."
                      className="text-xs h-7"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addTestimonial}
              className="w-full text-xs"
            >
              Add Testimonial
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// FAQ Section
function FaqSection({ theme, updateField }: SectionProps) {
  const addFaq = () => {
    updateField("faq_items", [
      ...theme.faq_items,
      { question: "", answer: "" },
    ]);
  };

  const updateFaq = (index: number, field: keyof FaqItem, value: string) => {
    const newFaqs = [...theme.faq_items];
    newFaqs[index] = { ...newFaqs[index], [field]: value };
    updateField("faq_items", newFaqs);
  };

  const removeFaq = (index: number) => {
    updateField(
      "faq_items",
      theme.faq_items.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            FAQ Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            Common questions and answers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.faq_enabled}
            onCheckedChange={(checked) => updateField("faq_enabled", checked)}
          />
        </div>
      </div>

      {theme.faq_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.faq_headline}
              onChange={(e) => updateField("faq_headline", e.target.value)}
              placeholder="Quick Answers"
              className="text-xs h-8"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs">Questions</Label>
            {theme.faq_items.map((faq, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-v2-canvas dark:bg-v2-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-v2-ink-muted">
                    Question {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFaq(index)}
                    className="h-6 text-xs text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Question</Label>
                  <Input
                    value={faq.question}
                    onChange={(e) =>
                      updateFaq(index, "question", e.target.value)
                    }
                    placeholder="Do I need prior experience?"
                    className="text-xs h-7"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Answer</Label>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(index, "answer", e.target.value)}
                    placeholder="No! We provide comprehensive training..."
                    className="text-xs min-h-[60px]"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addFaq}
              className="w-full text-xs"
            >
              Add Question
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Final CTA Section
function FinalCtaSection({ theme, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Final CTA Section
          </h3>
          <p className="text-xs text-v2-ink-muted">
            The closing call-to-action
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch
            checked={theme.final_cta_enabled}
            onCheckedChange={(checked) =>
              updateField("final_cta_enabled", checked)
            }
          />
        </div>
      </div>

      {theme.final_cta_enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={theme.final_cta_headline}
              onChange={(e) =>
                updateField("final_cta_headline", e.target.value)
              }
              placeholder="Ready to Start?"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Input
              value={theme.final_cta_subheadline}
              onChange={(e) =>
                updateField("final_cta_subheadline", e.target.value)
              }
              placeholder="Your future is waiting"
              className="text-xs h-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Button Text</Label>
              <Input
                value={theme.final_cta_text}
                onChange={(e) => updateField("final_cta_text", e.target.value)}
                placeholder="Apply Now"
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Button Link</Label>
              <Input
                value={theme.final_cta_link}
                onChange={(e) => updateField("final_cta_link", e.target.value)}
                placeholder="/join"
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SEO & Contact Section
function SeoContactSection({ theme, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">SEO Settings</h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          Search engine optimization and social sharing
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Page Title</Label>
            <Input
              value={theme.meta_title}
              onChange={(e) => updateField("meta_title", e.target.value)}
              placeholder="The Standard - Remote Insurance Sales Careers"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Meta Description</Label>
            <Textarea
              value={theme.meta_description}
              onChange={(e) => updateField("meta_description", e.target.value)}
              placeholder="Join The Standard and build a thriving career..."
              className="text-xs min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">OG Image URL</Label>
            <Input
              value={theme.og_image_url || ""}
              onChange={(e) =>
                updateField("og_image_url", e.target.value || null)
              }
              placeholder="https://..."
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">
          Contact Information
        </h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          Displayed in the footer
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Email</Label>
            <Input
              value={theme.contact_email || ""}
              onChange={(e) =>
                updateField("contact_email", e.target.value || null)
              }
              placeholder="careers@company.com"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Phone</Label>
            <Input
              value={theme.contact_phone || ""}
              onChange={(e) =>
                updateField("contact_phone", e.target.value || null)
              }
              placeholder="(555) 123-4567"
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Address</Label>
            <Input
              value={theme.contact_address || ""}
              onChange={(e) =>
                updateField("contact_address", e.target.value || null)
              }
              placeholder="123 Main St, City, State"
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">Social Links</h3>
        <p className="text-xs text-v2-ink-muted mb-4">
          Links to your social media profiles
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Instagram</Label>
            <Input
              value={theme.social_links?.instagram || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...theme.social_links,
                  instagram: e.target.value || undefined,
                })
              }
              placeholder="https://instagram.com/..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">YouTube</Label>
            <Input
              value={theme.social_links?.youtube || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...theme.social_links,
                  youtube: e.target.value || undefined,
                })
              }
              placeholder="https://youtube.com/..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">TikTok</Label>
            <Input
              value={theme.social_links?.tiktok || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...theme.social_links,
                  tiktok: e.target.value || undefined,
                })
              }
              placeholder="https://tiktok.com/..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Facebook</Label>
            <Input
              value={theme.social_links?.facebook || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...theme.social_links,
                  facebook: e.target.value || undefined,
                })
              }
              placeholder="https://facebook.com/..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Twitter/X</Label>
            <Input
              value={theme.social_links?.twitter || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...theme.social_links,
                  twitter: e.target.value || undefined,
                })
              }
              placeholder="https://twitter.com/..."
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
