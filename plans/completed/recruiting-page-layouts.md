# Recruiting Page Layout Variants Plan

## Current State

The recruiting page (`PublicJoinPage.tsx`) has a single layout:
- **Split-Panel Layout**: Dark hero panel on left (with branding, headline, stats), form panel on right
- Responsive: side-by-side on desktop, stacked on mobile

## Proposed Additional Layouts

### Layout 1: Centered Card Layout
**Description**: Clean, minimal design with a centered card containing the form, hero content above it.

**Visual Structure**:
```
┌─────────────────────────────────────────────┐
│          [Logo + Agency Name]               │
│                                             │
│   [Hero Image/Gradient Background]          │
│                                             │
│         ┌─────────────────────┐             │
│         │   Headline          │             │
│         │   Subheadline       │             │
│         │                     │             │
│         │   [Form Fields]     │             │
│         │                     │             │
│         │   [CTA Button]      │             │
│         └─────────────────────┘             │
│                                             │
│   [Social Links]    [Disclaimer]            │
└─────────────────────────────────────────────┘
```

**Best For**: Professional services, established agencies, mobile-first audiences

---

### Layout 2: Full-Width Hero with Sliding Form
**Description**: Immersive hero section spanning full viewport, with form sliding in from right side or as an expandable panel.

**Visual Structure**:
```
Desktop:
┌─────────────────────────────────────────────┐
│ [Full-width Hero Image/Video]               │
│                                             │
│   [Logo]                                    │
│   [Headline - Large Typography]             │
│   [Subheadline]                             │
│                                             │
│   [CTA Button "Apply Now"]──────────┐       │
│                                     │       │
│                              ┌──────▼──────┐│
│                              │ Form Panel  ││
│                              │ (Slide-in)  ││
│                              └─────────────┘│
└─────────────────────────────────────────────┘
```

**Best For**: Agencies with strong visual branding, hero imagery, or video content

---

### Layout 3: Multi-Section Scrolling Page
**Description**: Long-form landing page with multiple sections, encouraging users to scroll and learn before applying.

**Visual Structure**:
```
┌─────────────────────────────────────────────┐
│  Section 1: Hero                            │
│  [Logo] [Headline] [CTA]                    │
├─────────────────────────────────────────────┤
│  Section 2: About / Value Proposition       │
│  [About Text] [Key Benefits]                │
├─────────────────────────────────────────────┤
│  Section 3: Stats / Social Proof (Optional) │
│  [Average income] [Team size] [Success rate]│
├─────────────────────────────────────────────┤
│  Section 4: Application Form                │
│  [Form Fields]                              │
│  [CTA Button]                               │
├─────────────────────────────────────────────┤
│  Section 5: Footer                          │
│  [Social Links] [Disclaimer]                │
└─────────────────────────────────────────────┘
```

**Best For**: Agencies wanting to tell their story, build trust before conversion

---

## Implementation Plan

### Phase 1: Data Model & Settings
1. Add `layout_variant` field to `recruiting_page_settings` table
   - Type: `TEXT CHECK (layout_variant IN ('split-panel', 'centered-card', 'hero-slide', 'multi-section'))`
   - Default: `'split-panel'` (current layout)

2. Update `RecruitingPageSettings` and `RecruitingPageTheme` types
   - Add `layout_variant: 'split-panel' | 'centered-card' | 'hero-slide' | 'multi-section'`

3. Update `get_public_recruiting_theme` RPC to include layout_variant

### Phase 2: Layout Components
1. Refactor `PublicJoinPage.tsx`:
   - Extract current layout into `SplitPanelLayout.tsx`
   - Create layout component interface for consistent props

2. Create new layout components:
   - `CenteredCardLayout.tsx` - Layout 1
   - `HeroSlideLayout.tsx` - Layout 2
   - `MultiSectionLayout.tsx` - Layout 3

3. Create `LayoutRouter.tsx`:
   ```typescript
   function LayoutRouter({ theme, ...props }) {
     switch (theme.layout_variant) {
       case 'centered-card': return <CenteredCardLayout {...props} />;
       case 'hero-slide': return <HeroSlideLayout {...props} />;
       case 'multi-section': return <MultiSectionLayout {...props} />;
       default: return <SplitPanelLayout {...props} />;
     }
   }
   ```

### Phase 3: Settings UI
1. Add layout selector to `BrandingSettings.tsx`:
   - Visual preview cards for each layout
   - Radio selection for layout_variant
   - Preview button updates to show selected layout

### Phase 4: Shared Components
Extract reusable components used across layouts:
- `RecruitingHero.tsx` - Hero section with branding
- `RecruitingForm.tsx` - The application form
- `RecruitingStats.tsx` - Stats display (if enabled)
- `RecruitingFooter.tsx` - Footer with social links and disclaimer
- `RecruitingAbout.tsx` - About section content

---

## Migration Strategy

1. Add column with default value (no data migration needed)
2. Existing users automatically get `'split-panel'` (current behavior)
3. New layouts are opt-in via settings UI

---

## Files to Create/Modify

### New Files
- `src/features/recruiting/layouts/SplitPanelLayout.tsx`
- `src/features/recruiting/layouts/CenteredCardLayout.tsx`
- `src/features/recruiting/layouts/HeroSlideLayout.tsx`
- `src/features/recruiting/layouts/MultiSectionLayout.tsx`
- `src/features/recruiting/layouts/LayoutRouter.tsx`
- `src/features/recruiting/layouts/index.ts`
- `src/features/recruiting/components/shared/RecruitingHero.tsx`
- `src/features/recruiting/components/shared/RecruitingForm.tsx`
- `src/features/recruiting/components/shared/RecruitingStats.tsx`
- `src/features/recruiting/components/shared/RecruitingFooter.tsx`
- `supabase/migrations/YYYYMMDD_XXX_layout_variant.sql`

### Modified Files
- `src/types/recruiting-theme.types.ts` - Add layout_variant type
- `src/features/recruiting/pages/PublicJoinPage.tsx` - Use LayoutRouter
- `src/features/settings/components/BrandingSettings.tsx` - Add layout selector
- `supabase/migrations/20260114_001_recruiting_page_settings.sql` - Reference only

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Data Model | 1-2 hours |
| Phase 2: Layout Components | 6-8 hours |
| Phase 3: Settings UI | 2-3 hours |
| Phase 4: Shared Components | 3-4 hours |
| Testing & Polish | 2-3 hours |
| **Total** | **14-20 hours** |

---

## Open Questions for User

1. Should users be able to switch layouts without losing customizations?
2. Should there be layout-specific settings (e.g., hero video URL for Layout 2)?
3. Priority order for implementing the 3 layouts?
4. Any specific design inspiration/references to follow?
