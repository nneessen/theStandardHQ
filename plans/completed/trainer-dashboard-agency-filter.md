# Trainer Dashboard - Agency Pipeline Filter Feature

## Overview
Allow trainers/contracting managers to cycle through different agencies and view recruiting metrics per agency pipeline. This helps track which agencies have the most recruits, prospects, and pipeline activity.

## Data Model Understanding

### Existing Tables & Relationships
- **pipeline_templates**
  - `id`: Pipeline ID
  - `created_by`: User who created the pipeline (agency owner)
  - `imo_id`: IMO the pipeline belongs to
  - `name`, `description`, `is_active`, `is_default`

- **user_profiles** (recruits)
  - `pipeline_template_id`: Which pipeline the recruit is enrolled in
  - `recruiter_id` / `upline_id`: Who recruited them
  - `imo_id`: Which IMO they belong to
  - `onboarding_status`, `current_onboarding_phase`, `onboarding_started_at`

### Key Insight
Agency owners create their own `pipeline_templates`. Each recruit is assigned a specific `pipeline_template_id`. By grouping recruits by their assigned pipeline and fetching the pipeline creator, we can show "per-agency" metrics.

## Feature Requirements

### 1. Agency Selector Component
- Dropdown/tabs to cycle through agencies with active pipelines
- Show agency owner name and pipeline name
- "All Agencies" option for combined view
- Badge showing recruit count per agency

### 2. Agency-Filtered Metrics
When an agency is selected:
- Total enrolled recruits for that pipeline
- Active in pipeline
- Completed (MTD and total)
- Dropped
- Prospects (not enrolled)
- Needs attention (inactive 7+ days)
- Conversion rate
- Avg days to complete

### 3. Agency Comparison Summary
New dashboard section showing:
- Ranked list of agencies by # of active recruits
- Ranked list by # of prospects (pipeline waiting room)
- Visual indicators (badges, bar charts)

## Implementation Plan

### Phase 1: Data Layer (No new services needed)

**Existing services to leverage:**
- `pipelineService.getTemplates()` - Get all pipeline templates with creators
- `RecruitRepository.findRecruits()` - Already supports filtering by various criteria
- `RecruitRepository.getStats()` - Get stats for specific recruiter

**New query needed:**
```typescript
// Get recruits grouped by pipeline_template_id
// This query can be added to RecruitRepository or a new hook
const { data } = await supabase
  .from("user_profiles")
  .select(`
    id,
    pipeline_template_id,
    onboarding_status,
    current_onboarding_phase,
    onboarding_started_at,
    updated_at,
    created_at,
    pipeline_template:pipeline_template_id(
      id,
      name,
      created_by,
      creator:created_by(id, first_name, last_name, email)
    )
  `)
  .contains("roles", ["recruit"]);
```

### Phase 2: New Hook - `useAgencyPipelineStats`

Location: `src/features/training-hub/hooks/useAgencyPipelineStats.ts`

```typescript
interface AgencyPipelineStats {
  templateId: string;
  templateName: string;
  creatorId: string;
  creatorName: string;
  metrics: {
    total: number;
    active: number;
    completed: number;
    completedThisMonth: number;
    dropped: number;
    prospects: number;
    needsAttention: number;
    conversionRate: number;
    avgDaysToComplete: number;
  };
}

function useAgencyPipelineStats(): {
  data: AgencyPipelineStats[];
  isLoading: boolean;
  error: Error | null;
}
```

### Phase 3: UI Component - `AgencyPipelineOverview`

Location: `src/features/training-hub/components/AgencyPipelineOverview.tsx`

**Features:**
1. **Agency Tabs/Selector**
   - "All" tab (default) - aggregated metrics
   - Individual agency tabs with recruit counts

2. **Metrics Display**
   - Reuse existing `StatRow` and `KPIRow` components
   - Show filtered metrics based on selected agency

3. **Agency Comparison Card**
   - Top 5 agencies by active recruits (mini leaderboard)
   - Visual progress bars or badges

### Phase 4: Integration into TrainerDashboard

Add new section after "Detailed KPI Breakdown":

```tsx
{/* Agency Pipeline Breakdown - Staff only */}
{isStaffRole && (
  <AgencyPipelineOverview />
)}
```

## Edge Cases to Handle

1. **No Pipelines**: Show empty state if no pipeline templates exist
2. **Recruits without pipeline_template_id**: Group as "Unassigned"
3. **Inactive pipelines**: Optionally filter to active pipelines only
4. **Permission**: Only show to staff roles (trainer, contracting_manager)
5. **Loading states**: Skeleton loaders while data fetches
6. **Error handling**: Graceful fallback if query fails

## UI/UX Considerations

1. **Compact design**: Match existing dashboard zinc palette
2. **Quick filtering**: Click agency → stats update instantly
3. **Clear differentiation**: Visual cues for agency boundaries
4. **Mobile responsive**: Tabs collapse to dropdown on small screens

## Estimated File Changes

| File | Change |
|------|--------|
| `src/features/training-hub/hooks/useAgencyPipelineStats.ts` | **NEW** - Hook for fetching agency stats |
| `src/features/training-hub/components/AgencyPipelineOverview.tsx` | **NEW** - Main component |
| `src/features/training-hub/components/TrainerDashboard.tsx` | Add import + render AgencyPipelineOverview |

## No Changes Needed

- ✅ No new database tables
- ✅ No new migrations
- ✅ No changes to existing services (leverage existing queries)
- ✅ No changes to RLS policies

## Next Steps

1. Approve this plan
2. Implement `useAgencyPipelineStats` hook
3. Create `AgencyPipelineOverview` component
4. Integrate into `TrainerDashboard`
5. Test with multiple agencies/pipelines
6. Run typecheck and verify UI
