// src/features/underwriting/components/CriteriaReview/CriteriaEditor.tsx

import { useState, useMemo } from "react";
import {
  Calendar,
  ArrowLeft,
  Clock,
  Percent,
  Edit2,
  Save,
  X,
  DollarSign,
  AlertOctagon,
  Scale,
  Cigarette,
  Pill,
  MapPin,
  FileSearch,
  ClipboardCheck,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CriteriaSection } from "./CriteriaSection";
import { SourceExcerptsPanel } from "./SourceExcerptsPanel";
import { ApprovalDialog } from "./ApprovalDialog";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import type {
  CriteriaWithRelations,
  ExtractedCriteria,
  ReviewStatus,
} from "../../types/underwriting.types";
import {
  parseExtractedCriteria,
  parseSourceExcerpts,
} from "../../utils/criteria/criteriaValidation";

interface CriteriaEditorProps {
  criteria: CriteriaWithRelations;
  onBack: () => void;
  onSave?: (criteria: ExtractedCriteria) => Promise<void>;
  canEdit?: boolean;
}

export function CriteriaEditor({
  criteria,
  onBack,
  onSave,
  canEdit = false,
}: CriteriaEditorProps) {
  // Safely parse JSONB data with validation
  const parsedCriteria = useMemo(
    () => parseExtractedCriteria(criteria.criteria),
    [criteria.criteria],
  );
  const parsedExcerpts = useMemo(
    () => parseSourceExcerpts(criteria.source_excerpts),
    [criteria.source_excerpts],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editedCriteria, setEditedCriteria] = useState<ExtractedCriteria>(
    parsedCriteria.data,
  );
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sourceExcerpts = parsedExcerpts.data;
  const extractedCriteria = isEditing ? editedCriteria : parsedCriteria.data;
  const hasValidationErrors =
    !parsedCriteria.success || !parsedExcerpts.success;

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editedCriteria);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCriteria(parsedCriteria.data);
    setIsEditing(false);
  };

  const updateCriteria = (path: string, value: unknown) => {
    setEditedCriteria((prev) => {
      const newCriteria = { ...prev };
      const keys = path.split(".");
      let current: Record<string, unknown> = newCriteria;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== "object") {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = value;
      return newCriteria;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 px-2 text-[11px]"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h3 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
              {criteria.carrier?.name || "Unknown Carrier"}
            </h3>
            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {criteria.guide?.name || "Unknown Guide"}
              {criteria.product?.name && ` • ${criteria.product.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="h-7 px-2 text-[10px]"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700"
              >
                <Save className="h-3 w-3 mr-1" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-7 px-2 text-[10px]"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setApprovalOpen(true)}
                className="h-7 px-2 text-[10px]"
              >
                <ClipboardCheck className="h-3 w-3 mr-1" />
                Review
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Extracted:{" "}
            {criteria.extracted_at
              ? new Date(criteria.extracted_at).toLocaleDateString()
              : "N/A"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Percent className="h-3 w-3" />
          <span>
            Confidence:{" "}
            {criteria.extraction_confidence
              ? `${(criteria.extraction_confidence * 100).toFixed(0)}%`
              : "N/A"}
          </span>
        </div>
        <ReviewStatusBadge
          status={criteria.review_status as ReviewStatus}
          isActive={criteria.is_active}
          showIcon={false}
        />
      </div>

      {/* Validation Warning */}
      {hasValidationErrors && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[10px] text-amber-800 dark:text-amber-200">
            <p className="font-medium">Data validation warning</p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              Some criteria fields failed validation and may not be displayed
              correctly. Consider re-extracting the criteria from the source
              guide.
            </p>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Criteria Sections - Left 2/3 */}
        <div className="lg:col-span-2 space-y-2">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2 pr-3">
              {/* Age Limits */}
              <CriteriaSection
                title="Age Limits"
                icon={<Calendar className="h-3 w-3" />}
                defaultOpen={true}
                isEmpty={!extractedCriteria.ageLimits}
              >
                <AgeLimitsSection
                  data={extractedCriteria.ageLimits}
                  isEditing={isEditing}
                  onChange={(val) => updateCriteria("ageLimits", val)}
                />
              </CriteriaSection>

              {/* Face Amount Limits */}
              <CriteriaSection
                title="Face Amount Limits"
                icon={<DollarSign className="h-3 w-3" />}
                isEmpty={!extractedCriteria.faceAmountLimits}
                badge={
                  extractedCriteria.faceAmountLimits?.ageTiers?.length ? (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0">
                      {extractedCriteria.faceAmountLimits.ageTiers.length} tiers
                    </Badge>
                  ) : null
                }
              >
                <FaceAmountSection
                  data={extractedCriteria.faceAmountLimits}
                  isEditing={isEditing}
                  onChange={(val) => updateCriteria("faceAmountLimits", val)}
                />
              </CriteriaSection>

              {/* Knockout Conditions */}
              <CriteriaSection
                title="Knockout Conditions"
                icon={<AlertOctagon className="h-3 w-3" />}
                isEmpty={
                  !extractedCriteria.knockoutConditions?.descriptions?.length
                }
                badge={
                  extractedCriteria.knockoutConditions?.descriptions?.length ? (
                    <Badge
                      variant="destructive"
                      className="text-[8px] px-1 py-0"
                    >
                      {extractedCriteria.knockoutConditions.descriptions.length}{" "}
                      conditions
                    </Badge>
                  ) : null
                }
              >
                <KnockoutConditionsSection
                  data={extractedCriteria.knockoutConditions}
                />
              </CriteriaSection>

              {/* Build Requirements */}
              <CriteriaSection
                title="Build/BMI Requirements"
                icon={<Scale className="h-3 w-3" />}
                isEmpty={!extractedCriteria.buildRequirements}
              >
                <BuildRequirementsSection
                  data={extractedCriteria.buildRequirements}
                  isEditing={isEditing}
                  onChange={(val) => updateCriteria("buildRequirements", val)}
                />
              </CriteriaSection>

              {/* Tobacco Rules */}
              <CriteriaSection
                title="Tobacco Rules"
                icon={<Cigarette className="h-3 w-3" />}
                isEmpty={!extractedCriteria.tobaccoRules}
              >
                <TobaccoRulesSection data={extractedCriteria.tobaccoRules} />
              </CriteriaSection>

              {/* Medication Restrictions */}
              <CriteriaSection
                title="Medication Restrictions"
                icon={<Pill className="h-3 w-3" />}
                isEmpty={!extractedCriteria.medicationRestrictions}
              >
                <MedicationRestrictionsSection
                  data={extractedCriteria.medicationRestrictions}
                />
              </CriteriaSection>

              {/* State Availability */}
              <CriteriaSection
                title="State Availability"
                icon={<MapPin className="h-3 w-3" />}
                isEmpty={
                  !extractedCriteria.stateAvailability?.availableStates?.length
                }
                badge={
                  extractedCriteria.stateAvailability?.unavailableStates
                    ?.length ? (
                    <Badge
                      variant="destructive"
                      className="text-[8px] px-1 py-0"
                    >
                      {
                        extractedCriteria.stateAvailability.unavailableStates
                          .length
                      }{" "}
                      excluded
                    </Badge>
                  ) : null
                }
              >
                <StateAvailabilitySection
                  data={extractedCriteria.stateAvailability}
                />
              </CriteriaSection>

              {/* Coverage Options */}
              <CriteriaSection
                title="Coverage Options"
                icon={<Shield className="h-3 w-3" />}
                isEmpty={!extractedCriteria.coverageOptions}
                badge={
                  extractedCriteria.coverageOptions?.riders?.length ? (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0">
                      {extractedCriteria.coverageOptions.riders.length} riders
                    </Badge>
                  ) : null
                }
              >
                <CoverageOptionsSection
                  data={extractedCriteria.coverageOptions}
                />
              </CriteriaSection>
            </div>
          </ScrollArea>
        </div>

        {/* Source Excerpts - Right 1/3 */}
        <div className="border border-v2-ring dark:border-v2-ring-strong rounded-md p-3 bg-v2-canvas/50 dark:bg-v2-card-tinted/30">
          <div className="flex items-center gap-2 mb-3">
            <FileSearch className="h-3.5 w-3.5 text-v2-ink-muted" />
            <h4 className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
              Audit Trail
            </h4>
          </div>
          <SourceExcerptsPanel
            excerpts={sourceExcerpts}
            maxHeight="calc(100vh - 340px)"
          />
        </div>
      </div>

      {/* Approval Dialog */}
      <ApprovalDialog
        criteria={criteria}
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        onSuccess={onBack}
      />
    </div>
  );
}

// Sub-components for each section

function AgeLimitsSection({
  data,
  isEditing,
  onChange,
}: {
  data: ExtractedCriteria["ageLimits"];
  isEditing: boolean;
  onChange: (val: ExtractedCriteria["ageLimits"]) => void;
}) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
          Minimum Issue Age
        </label>
        {isEditing ? (
          <Input
            type="number"
            value={data.minIssueAge}
            onChange={(e) =>
              onChange({ ...data, minIssueAge: parseInt(e.target.value) || 0 })
            }
            className="h-7 text-[11px] mt-1"
          />
        ) : (
          <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
            {data.minIssueAge} years
          </p>
        )}
      </div>
      <div>
        <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
          Maximum Issue Age
        </label>
        {isEditing ? (
          <Input
            type="number"
            value={data.maxIssueAge}
            onChange={(e) =>
              onChange({ ...data, maxIssueAge: parseInt(e.target.value) || 0 })
            }
            className="h-7 text-[11px] mt-1"
          />
        ) : (
          <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
            {data.maxIssueAge} years
          </p>
        )}
      </div>
    </div>
  );
}

function FaceAmountSection({
  data,
  isEditing,
  onChange,
}: {
  data: ExtractedCriteria["faceAmountLimits"];
  isEditing: boolean;
  onChange: (val: ExtractedCriteria["faceAmountLimits"]) => void;
}) {
  if (!data) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
            Minimum Face Amount
          </label>
          {isEditing ? (
            <Input
              type="number"
              value={data.minimum}
              onChange={(e) =>
                onChange({ ...data, minimum: parseInt(e.target.value) || 0 })
              }
              className="h-7 text-[11px] mt-1"
            />
          ) : (
            <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
              {formatCurrency(data.minimum)}
            </p>
          )}
        </div>
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
            Maximum Face Amount
          </label>
          {isEditing ? (
            <Input
              type="number"
              value={data.maximum}
              onChange={(e) =>
                onChange({ ...data, maximum: parseInt(e.target.value) || 0 })
              }
              className="h-7 text-[11px] mt-1"
            />
          ) : (
            <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
              {formatCurrency(data.maximum)}
            </p>
          )}
        </div>
      </div>

      {data.ageTiers && data.ageTiers.length > 0 && (
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
            Age-Based Tiers
          </label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 text-[9px] px-2">Age Range</TableHead>
                <TableHead className="h-7 text-[9px] px-2 text-right">
                  Max Face Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ageTiers.map((tier, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-1.5 px-2 text-[10px]">
                    {tier.minAge} - {tier.maxAge} years
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-[10px] text-right font-medium">
                    {formatCurrency(tier.maxFaceAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KnockoutConditionsSection({
  data,
}: {
  data: ExtractedCriteria["knockoutConditions"];
}) {
  if (!data?.descriptions?.length) return null;

  const getSeverityBadge = (severity: string) => {
    const lower = severity.toLowerCase();
    if (lower === "high" || lower === "decline") {
      return (
        <Badge variant="destructive" className="text-[8px] px-1 py-0 uppercase">
          {severity}
        </Badge>
      );
    }
    if (lower === "medium" || lower === "table") {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[8px] px-1 py-0 uppercase">
          {severity}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[8px] px-1 py-0 uppercase">
        {severity}
      </Badge>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-7 text-[9px] px-2 w-20">Code</TableHead>
          <TableHead className="h-7 text-[9px] px-2">Condition</TableHead>
          <TableHead className="h-7 text-[9px] px-2 w-24">Severity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.descriptions.map((desc, idx) => (
          <TableRow key={idx}>
            <TableCell className="py-1.5 px-2 text-[10px] font-mono">
              {desc.code}
            </TableCell>
            <TableCell className="py-1.5 px-2 text-[10px]">
              {desc.name}
            </TableCell>
            <TableCell className="py-1.5 px-2">
              {getSeverityBadge(desc.severity)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BuildRequirementsSection({
  data,
  isEditing,
  onChange,
}: {
  data: ExtractedCriteria["buildRequirements"];
  isEditing: boolean;
  onChange: (val: ExtractedCriteria["buildRequirements"]) => void;
}) {
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
          Measurement Type
        </label>
        <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink capitalize">
          {data.type === "height_weight" ? "Height/Weight Chart" : "BMI-Based"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {data.preferredPlusBmiMax && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              Preferred Plus Max BMI
            </label>
            {isEditing ? (
              <Input
                type="number"
                step="0.1"
                value={data.preferredPlusBmiMax}
                onChange={(e) =>
                  onChange({
                    ...data,
                    preferredPlusBmiMax: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-7 text-[11px] mt-1"
              />
            ) : (
              <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
                {data.preferredPlusBmiMax}
              </p>
            )}
          </div>
        )}
        {data.preferredBmiMax && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              Preferred Max BMI
            </label>
            {isEditing ? (
              <Input
                type="number"
                step="0.1"
                value={data.preferredBmiMax}
                onChange={(e) =>
                  onChange({
                    ...data,
                    preferredBmiMax: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-7 text-[11px] mt-1"
              />
            ) : (
              <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
                {data.preferredBmiMax}
              </p>
            )}
          </div>
        )}
        {data.standardBmiMax && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              Standard Max BMI
            </label>
            {isEditing ? (
              <Input
                type="number"
                step="0.1"
                value={data.standardBmiMax}
                onChange={(e) =>
                  onChange({
                    ...data,
                    standardBmiMax: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-7 text-[11px] mt-1"
              />
            ) : (
              <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
                {data.standardBmiMax}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TobaccoRulesSection({
  data,
}: {
  data: ExtractedCriteria["tobaccoRules"];
}) {
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Nicotine Test Required:
        </span>
        <Badge
          variant={data.nicotineTestRequired ? "default" : "secondary"}
          className="text-[9px] px-1.5 py-0"
        >
          {data.nicotineTestRequired ? "Yes" : "No"}
        </Badge>
      </div>

      {data.smokingClassifications &&
        data.smokingClassifications.length > 0 && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
              Smoking Classifications
            </label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 text-[9px] px-2">
                    Classification
                  </TableHead>
                  <TableHead className="h-7 text-[9px] px-2 text-right">
                    Clean Months Required
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.smokingClassifications.map((cls, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="py-1.5 px-2 text-[10px] capitalize">
                      {cls.classification}
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-[10px] text-right">
                      {cls.requiresCleanMonths} months
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}

function MedicationRestrictionsSection({
  data,
}: {
  data: ExtractedCriteria["medicationRestrictions"];
}) {
  if (!data) return null;

  const restrictions: Array<{ label: string; value: string }> = [];

  if (data.insulin) {
    restrictions.push({
      label: "Insulin",
      value: data.insulin.allowed
        ? data.insulin.ratingImpact
          ? `Allowed (${data.insulin.ratingImpact})`
          : "Allowed"
        : "Not Allowed",
    });
  }
  if (data.bloodThinners) {
    restrictions.push({
      label: "Blood Thinners",
      value: data.bloodThinners.allowed ? "Allowed" : "Not Allowed",
    });
  }
  if (data.antidepressants) {
    restrictions.push({
      label: "Antidepressants",
      value: data.antidepressants.allowed ? "Allowed" : "Not Allowed",
    });
  }
  if (data.opioids) {
    restrictions.push({
      label: "Opioids",
      value: data.opioids.allowed
        ? data.opioids.timeSinceUse
          ? `Allowed (${data.opioids.timeSinceUse}+ months since use)`
          : "Allowed"
        : "Not Allowed",
    });
  }
  if (data.bpMedications) {
    restrictions.push({
      label: "BP Medications",
      value: `Max ${data.bpMedications.maxCount} medications`,
    });
  }

  if (restrictions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {restrictions.map((r, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-2 bg-v2-canvas dark:bg-v2-card-tinted/50 rounded"
        >
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            {r.label}
          </span>
          <Badge
            variant={r.value.includes("Not") ? "destructive" : "secondary"}
            className="text-[9px] px-1.5 py-0"
          >
            {r.value}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function StateAvailabilitySection({
  data,
}: {
  data: ExtractedCriteria["stateAvailability"];
}) {
  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.availableStates && data.availableStates.length > 0 && (
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
            Available States ({data.availableStates.length})
          </label>
          <div className="flex flex-wrap gap-1">
            {data.availableStates.map((state) => (
              <Badge
                key={state}
                variant="secondary"
                className="text-[9px] px-1.5 py-0"
              >
                {state}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {data.unavailableStates && data.unavailableStates.length > 0 && (
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
            Excluded States ({data.unavailableStates.length})
          </label>
          <div className="flex flex-wrap gap-1">
            {data.unavailableStates.map((state) => (
              <Badge
                key={state}
                variant="destructive"
                className="text-[9px] px-1.5 py-0"
              >
                {state}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageOptionsSection({
  data,
}: {
  data: ExtractedCriteria["coverageOptions"];
}) {
  if (!data) return null;

  const formatLabel = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-3">
      {/* Product Types & Underwriting Type */}
      <div className="grid grid-cols-2 gap-4">
        {data.productTypes && data.productTypes.length > 0 && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
              Product Types
            </label>
            <div className="flex flex-wrap gap-1">
              {data.productTypes.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0 capitalize"
                >
                  {formatLabel(t)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {data.underwritingType && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              Underwriting Type
            </label>
            <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink capitalize">
              {formatLabel(data.underwritingType)}
            </p>
          </div>
        )}
      </div>

      {/* Available Terms */}
      {data.availableTerms && data.availableTerms.length > 0 && (
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
            Available Terms
          </label>
          <div className="flex flex-wrap gap-1">
            {data.availableTerms
              .sort((a, b) => a - b)
              .map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0"
                >
                  {t} years
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Rating Classes */}
      {data.ratingClasses && data.ratingClasses.length > 0 && (
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
            Rating Classes
          </label>
          <div className="flex flex-wrap gap-1">
            {data.ratingClasses.map((c) => (
              <Badge
                key={c}
                variant="secondary"
                className="text-[9px] px-1.5 py-0 capitalize"
              >
                {formatLabel(c)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Privilege & Accelerated UW */}
      <div className="grid grid-cols-2 gap-4">
        {data.conversionPrivilege && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              Conversion Privilege
            </label>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant={
                  data.conversionPrivilege.allowed ? "default" : "destructive"
                }
                className="text-[9px] px-1.5 py-0"
              >
                {data.conversionPrivilege.allowed ? "Allowed" : "Not Allowed"}
              </Badge>
              {data.conversionPrivilege.maxAge && (
                <span className="text-[10px] text-v2-ink-muted">
                  to age {data.conversionPrivilege.maxAge}
                </span>
              )}
              {data.conversionPrivilege.maxYears && (
                <span className="text-[10px] text-v2-ink-muted">
                  within {data.conversionPrivilege.maxYears} yrs
                </span>
              )}
            </div>
          </div>
        )}
        {data.acceleratedUnderwriting !== undefined && (
          <div>
            <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide">
              Accelerated Underwriting
            </label>
            <Badge
              variant={data.acceleratedUnderwriting ? "default" : "secondary"}
              className="text-[9px] px-1.5 py-0 mt-0.5"
            >
              {data.acceleratedUnderwriting ? "Available" : "Not Available"}
            </Badge>
          </div>
        )}
      </div>

      {/* Riders */}
      {data.riders && data.riders.length > 0 && (
        <div>
          <label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-1 block">
            Riders ({data.riders.length})
          </label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 text-[9px] px-2">Rider</TableHead>
                <TableHead className="h-7 text-[9px] px-2">
                  Description
                </TableHead>
                <TableHead className="h-7 text-[9px] px-2 w-20">
                  Included
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.riders.map((rider, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-1.5 px-2 text-[10px] font-medium">
                    {rider.name}
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-[10px] text-v2-ink-muted">
                    {rider.description || "—"}
                  </TableCell>
                  <TableCell className="py-1.5 px-2">
                    <Badge
                      variant={rider.included ? "default" : "secondary"}
                      className="text-[8px] px-1 py-0"
                    >
                      {rider.included ? "Included" : "Optional"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
