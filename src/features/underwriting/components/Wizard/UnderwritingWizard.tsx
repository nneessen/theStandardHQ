// src/features/underwriting/components/UnderwritingWizard.tsx

import { useState, useCallback, useRef, Suspense } from "react";
import { UWWizardDisclaimerGate } from "./UWWizardDisclaimerGate";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Sparkles,
  Zap,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  useUnderwritingAnalysis,
  UWAnalysisError,
} from "../../hooks/wizard/useUnderwritingAnalysis";
import { useSaveUnderwritingSession } from "../../hooks/sessions/useUnderwritingSessions";
import {
  useDecisionEngineRecommendations,
  buildAuthoritativeUnderwritingRunInput,
  buildAuthoritativeSessionSaveInput,
} from "../../hooks/wizard/useDecisionEngineRecommendations";
import { useHealthConditions } from "../../hooks/shared/useHealthConditions";
import {
  useUWWizardUsage,
  useRecordUWWizardRun,
  getUsageStatus,
} from "../../hooks/wizard/useUWWizardUsage";
import { useUnderwritingFeatureFlag } from "../../hooks/wizard/useUnderwritingFeatureFlag";
import { calculateBMI } from "../../utils/shared/bmiCalculator";
import { getMissingRequiredFollowUps } from "../../utils/wizard/follow-up-validation";
import { parseSessionHealthSnapshot } from "../../utils/sessions/session-health-snapshot";
import { getRequestedFaceAmounts } from "../../utils/sessions/session-persistence";
import type {
  WizardFormData,
  WizardStep,
  ClientInfo,
  HealthInfo,
  CoverageRequest,
  AIAnalysisResult,
  AIAnalysisRequest,
  UnderwritingSession,
  ConditionResponse,
  TobaccoInfo,
  ProductType,
} from "../../types/underwriting.types";
import { WIZARD_STEPS } from "../../types/underwriting.types";
import { safeParseJsonArray } from "../../utils/shared/formatters";

// Layout and step components
import { WizardPageLayout } from "./wizard-page-layout";
import { WizardSessionHistory } from "../SessionHistory";
import { UWLimitReachedDialog } from "./UWLimitReachedDialog";
import ClientInfoStep from "./Steps/ClientInfoStep";
import HealthConditionsStep from "./Steps/HealthConditionsStep";
import MedicationsStep from "./Steps/MedicationsStep";
import CoverageRequestStep from "./Steps/CoverageRequestStep";
import ReviewStep from "./Steps/ReviewStep";
import RecommendationsStep from "./Steps/RecommendationsStep";
import WizardInfoPanel from "./WizardInfoPanel";

const initialClientInfo: ClientInfo = {
  name: "",
  dob: null,
  age: 0,
  gender: "",
  state: "",
  heightFeet: 5,
  heightInches: 6,
  weight: 150,
};

const initialHealthInfo: HealthInfo = {
  conditions: [],
  tobacco: {
    currentUse: false,
  },
  medications: {
    bpMedCount: 0,
    bloodThinners: false,
    heartMeds: false,
    cholesterolMedCount: 0,
    insulinUse: false,
    oralDiabetesMeds: false,
    antidepressants: false,
    antianxiety: false,
    antipsychotics: false,
    moodStabilizers: false,
    sleepAids: false,
    adhdMeds: false,
    painMedications: "none",
    seizureMeds: false,
    migraineMeds: false,
    inhalers: false,
    copdMeds: false,
    thyroidMeds: false,
    hormonalTherapy: false,
    steroids: false,
    immunosuppressants: false,
    biologics: false,
    dmards: false,
    cancerTreatment: false,
    antivirals: false,
    osteoporosisMeds: false,
    kidneyMeds: false,
    liverMeds: false,
  },
};

const initialCoverageRequest: CoverageRequest = {
  faceAmounts: [250000, 500000, 1000000],
  productTypes: ["term_life"],
};

/**
 * Thin wrapper: checks the feature flag and guards against rendering
 * the inner component (which contains all hooks) until the flag is resolved.
 * This ensures all hooks in UnderwritingWizardInner run unconditionally.
 */
export default function UnderwritingWizardPage() {
  const navigate = useNavigate();
  const { isEnabled, isLoading: featureLoading } = useUnderwritingFeatureFlag();

  if (featureLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isEnabled) {
    navigate({ to: "/policies" });
    return null;
  }

  return <UnderwritingWizardInner />;
}

/**
 * Inner component: all hooks are unconditional.
 * No early returns before any hook call.
 */
function UnderwritingWizardInner() {
  const navigate = useNavigate();
  const [acknowledged, setAcknowledged] = useState(
    () => sessionStorage.getItem("uw-wizard-acknowledged") === "true",
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<WizardFormData>({
    client: initialClientInfo,
    health: initialHealthInfo,
    coverage: initialCoverageRequest,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(
    null,
  );
  const [sessionStartTime] = useState<number>(Date.now());
  const [selectedTermYears, setSelectedTermYears] = useState<number | null>(
    null,
  );
  const [lastAnalyzedData, setLastAnalyzedData] = useState<string | null>(null);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const analysisInFlightRef = useRef(false);
  const pendingRunKeyRef = useRef<string | null>(null);

  const { user } = useAuth();
  const analysisMutation = useUnderwritingAnalysis();
  const decisionEngineMutation = useDecisionEngineRecommendations();
  const saveSessionMutation = useSaveUnderwritingSession();
  const recordRunMutation = useRecordUWWizardRun();
  const {
    data: healthConditions = [],
    isLoading: healthConditionsLoading,
    error: healthConditionsError,
  } = useHealthConditions();

  const { data: usageData, refetch: refetchUsage } = useUWWizardUsage();
  const usageStatus = getUsageStatus(usageData);

  const currentStep = WIZARD_STEPS[currentStepIndex];

  // Validation functions
  const validateClientInfo = (): boolean => {
    const newErrors: Record<string, string> = {};
    const { client } = formData;

    if (!client.age || client.age < 1) {
      newErrors.age = "Age is required";
    } else if (client.age < 18 || client.age > 100) {
      newErrors.age = "Age must be between 18 and 100";
    }

    if (!client.gender) {
      newErrors.gender = "Gender is required";
    }

    if (!client.state) {
      newErrors.state = "State is required";
    }

    if (!client.heightFeet || client.heightFeet < 3 || client.heightFeet > 8) {
      newErrors.height = "Invalid height";
    }

    if (!client.weight || client.weight < 50 || client.weight > 600) {
      newErrors.weight = "Weight must be between 50 and 600 lbs";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateHealthInfo = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (healthConditionsLoading) {
      newErrors.health =
        "Health condition requirements are still loading. Please wait a moment.";
      setErrors(newErrors);
      return false;
    }

    if (healthConditionsError) {
      newErrors.health =
        "Unable to validate required health questions right now.";
      newErrors.healthDetails =
        "Condition requirements could not be loaded. Please retry before continuing.";
      setErrors(newErrors);
      return false;
    }

    const missingFollowUps = getMissingRequiredFollowUps(
      formData.health.conditions,
      healthConditions,
    );

    if (missingFollowUps.length > 0) {
      const missingConditionNames = [
        ...new Set(missingFollowUps.map((item) => item.conditionName)),
      ];

      newErrors.health =
        "Complete the required follow-up questions before continuing.";
      newErrors.healthDetails = `Missing required answers for ${missingConditionNames.join(", ")}.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCoverageRequest = (): boolean => {
    const newErrors: Record<string, string> = {};
    const { coverage } = formData;

    const validAmounts = coverage.faceAmounts.filter((amt) => amt >= 10000);
    if (validAmounts.length === 0) {
      newErrors.faceAmounts =
        "At least one face amount must be $10,000 or more";
    }

    if (!coverage.productTypes || coverage.productTypes.length === 0) {
      newErrors.productTypes = "Select at least one product type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep = (stepId: WizardStep): boolean => {
    switch (stepId) {
      case "client":
        return validateClientInfo();
      case "health":
        return validateHealthInfo();
      case "medications":
        return true;
      case "coverage":
        return validateCoverageRequest();
      case "review":
      case "results":
        return true;
      default:
        return true;
    }
  };

  const getDataHash = () => {
    return JSON.stringify({
      client: formData.client,
      health: formData.health,
      coverage: formData.coverage,
    });
  };

  // Navigation handlers
  const handleNext = async () => {
    if (!validateStep(currentStep.id)) {
      return;
    }

    if (currentStep.id === "review") {
      const currentDataHash = getDataHash();

      if (lastAnalyzedData === currentDataHash && analysisResult) {
        setCurrentStepIndex((prev) => prev + 1);
        return;
      }

      if (usageData && usageData.runs_remaining <= 0) {
        setShowLimitDialog(true);
        return;
      }

      if (analysisInFlightRef.current) return;
      analysisInFlightRef.current = true;

      const bmi = calculateBMI(
        formData.client.heightFeet,
        formData.client.heightInches,
        formData.client.weight,
      );
      const runKey = crypto.randomUUID();
      pendingRunKeyRef.current = runKey;

      const aiRequest: AIAnalysisRequest = {
        client: {
          age: formData.client.age,
          gender: formData.client.gender,
          state: formData.client.state,
          bmi,
        },
        health: {
          conditions: formData.health.conditions.map((c) => ({
            code: c.conditionCode,
            responses: c.responses,
          })),
          tobacco: formData.health.tobacco,
          medications: formData.health.medications,
        },
        coverage: {
          faceAmount:
            formData.coverage.faceAmounts.find((a) => a >= 10000) ||
            formData.coverage.faceAmounts[0] ||
            0,
          productTypes: formData.coverage.productTypes,
        },
        imoId: user?.imo_id || undefined,
        runKey,
      };

      const decisionInput = buildAuthoritativeUnderwritingRunInput({
        clientInfo: formData.client,
        healthInfo: formData.health,
        coverageRequest: formData.coverage,
        runKey,
        selectedTermYears,
      });

      setLastAnalyzedData(currentDataHash);

      analysisMutation.mutate(aiRequest, {
        onSuccess: (result) => {
          analysisInFlightRef.current = false;
          setAnalysisResult(result);
          const pendingRunKey = pendingRunKeyRef.current;

          if (result.usageRecorded !== true && pendingRunKey && user?.imo_id) {
            recordRunMutation.mutate(
              {
                imoId: user.imo_id,
                runKey: pendingRunKey,
              },
              {
                onError: (recordError) => {
                  console.error(
                    "[UW Wizard] Failed to record run client-side fallback:",
                    recordError,
                  );
                },
                onSettled: () => {
                  refetchUsage();
                },
              },
            );
          } else {
            refetchUsage();
          }
        },
        onError: (error: UWAnalysisError) => {
          analysisInFlightRef.current = false;
          pendingRunKeyRef.current = null;
          setLastAnalyzedData(null);

          if (error instanceof UWAnalysisError) {
            if (error.code === "limit_exceeded" || error.status === 429) {
              refetchUsage();
              setShowLimitDialog(true);
              return;
            }
            if (error.code === "no_subscription" || error.status === 403) {
              setErrors({
                submit:
                  "UW Wizard subscription required. Visit Billing to subscribe.",
              });
              return;
            }
          }

          setErrors({ submit: "AI analysis failed. Please try again." });
        },
      });
      decisionEngineMutation.mutate(decisionInput);

      setCurrentStepIndex((prev) => prev + 1);
      return;
    }

    setCurrentStepIndex((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
    setErrors({});
  };

  const canNavigateToStep = useCallback(
    (stepId: WizardStep): boolean => {
      const targetIndex = WIZARD_STEPS.findIndex((s) => s.id === stepId);
      if (targetIndex < currentStepIndex) return true;
      if (
        stepId === "results" &&
        analysisResult &&
        lastAnalyzedData === getDataHash()
      ) {
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStepIndex, analysisResult, lastAnalyzedData, formData],
  );

  const handleStepClick = useCallback(
    (stepId: WizardStep) => {
      if (!canNavigateToStep(stepId)) return;
      const targetIndex = WIZARD_STEPS.findIndex((s) => s.id === stepId);
      setCurrentStepIndex(targetIndex);
      setErrors({});
    },
    [canNavigateToStep],
  );

  // Update form data
  const updateClientInfo = useCallback((updates: Partial<ClientInfo>) => {
    setFormData((prev) => ({
      ...prev,
      client: { ...prev.client, ...updates },
    }));
    setErrors({});
  }, []);

  const updateHealthInfo = useCallback((updates: Partial<HealthInfo>) => {
    setFormData((prev) => ({
      ...prev,
      health: { ...prev.health, ...updates },
    }));
    setErrors({});
  }, []);

  const updateCoverageRequest = useCallback(
    (updates: Partial<CoverageRequest>) => {
      setFormData((prev) => ({
        ...prev,
        coverage: { ...prev.coverage, ...updates },
      }));
      setErrors({});
    },
    [],
  );

  const updateMedications = useCallback(
    (updates: Partial<HealthInfo["medications"]>) => {
      setFormData((prev) => ({
        ...prev,
        health: {
          ...prev.health,
          medications: { ...prev.health.medications, ...updates },
        },
      }));
      setErrors({});
    },
    [],
  );

  const handleTermChange = useCallback(
    (termYears: number | null) => {
      setSelectedTermYears(termYears);
      const decisionInput = buildAuthoritativeUnderwritingRunInput({
        clientInfo: formData.client,
        healthInfo: formData.health,
        coverageRequest: formData.coverage,
        runKey: pendingRunKeyRef.current || crypto.randomUUID(),
        selectedTermYears: termYears,
      });
      if (!pendingRunKeyRef.current) {
        pendingRunKeyRef.current = decisionInput.runKey;
      }
      decisionEngineMutation.mutate(decisionInput);
    },
    [formData, decisionEngineMutation],
  );

  const handleSaveSession = useCallback(async () => {
    const authoritativeRun = decisionEngineMutation.data;
    if (!analysisResult || !authoritativeRun?.authoritativeRunEnvelope) return;

    const sessionData = buildAuthoritativeSessionSaveInput({
      clientInfo: formData.client,
      healthInfo: formData.health,
      coverageRequest: formData.coverage,
      runKey:
        pendingRunKeyRef.current ||
        authoritativeRun.authoritativeRunEnvelope.input.runKey,
      authoritativeRunEnvelope: authoritativeRun.authoritativeRunEnvelope,
      selectedTermYears,
      sessionDurationSeconds: Math.floor(
        (Date.now() - sessionStartTime) / 1000,
      ),
    });
    pendingRunKeyRef.current =
      sessionData.input.runKey || pendingRunKeyRef.current;

    try {
      await saveSessionMutation.mutateAsync(sessionData);
      navigate({ to: "/policies" });
    } catch {
      setErrors({ submit: "Failed to save session. Please try again." });
    }
  }, [
    analysisResult,
    decisionEngineMutation.data,
    formData,
    sessionStartTime,
    saveSessionMutation,
    navigate,
    selectedTermYears,
  ]);

  const handleLoadSession = useCallback(
    (session: UnderwritingSession) => {
      const totalHeightInches = session.client_height_inches || 66;
      const heightFeet = Math.floor(totalHeightInches / 12);
      const heightInches = totalHeightInches % 12;

      const healthSnapshot = parseSessionHealthSnapshot(
        session.health_responses,
      );
      const conditions: ConditionResponse[] = healthSnapshot.conditions;
      const tobaccoDetails = session.tobacco_details as TobaccoInfo | null;
      const productTypes = safeParseJsonArray<ProductType>(
        session.requested_product_types,
      );
      const requestedFaceAmounts = getRequestedFaceAmounts(session);

      const loadedFormData: WizardFormData = {
        client: {
          name: session.client_name || "",
          dob: session.client_dob || null,
          age: session.client_age || 0,
          gender: (session.client_gender as ClientInfo["gender"]) || "",
          state: session.client_state || "",
          heightFeet,
          heightInches,
          weight: session.client_weight_lbs || 150,
        },
        health: {
          conditions,
          tobacco: tobaccoDetails || {
            currentUse: session.tobacco_use || false,
          },
          medications:
            healthSnapshot.medications || initialHealthInfo.medications,
        },
        coverage: {
          faceAmounts:
            requestedFaceAmounts.length > 0
              ? requestedFaceAmounts
              : [250000, 500000, 1000000],
          productTypes: productTypes.length > 0 ? productTypes : ["term_life"],
        },
      };

      setFormData(loadedFormData);
      setAnalysisResult(null);
      setLastAnalyzedData(null);
      setSelectedTermYears(null);
      analysisMutation.reset();
      decisionEngineMutation.reset();
      pendingRunKeyRef.current = null;
      setCurrentStepIndex(0);
      setShowHistorySheet(false);
      setErrors({});
    },
    [analysisMutation, decisionEngineMutation],
  );

  // Render current step
  const renderStepContent = () => {
    switch (currentStep.id) {
      case "client":
        return (
          <ClientInfoStep
            data={formData.client}
            onChange={updateClientInfo}
            errors={errors}
          />
        );
      case "health":
        return (
          <HealthConditionsStep
            data={formData.health}
            onChange={updateHealthInfo}
            errors={errors}
          />
        );
      case "medications":
        return (
          <MedicationsStep
            data={formData.health.medications}
            onChange={updateMedications}
            errors={errors}
          />
        );
      case "coverage":
        return (
          <CoverageRequestStep
            data={formData.coverage}
            onChange={updateCoverageRequest}
            errors={errors}
          />
        );
      case "review":
        return (
          <ReviewStep
            clientInfo={formData.client}
            healthInfo={formData.health}
            coverageRequest={formData.coverage}
          />
        );
      case "results":
        return (
          <RecommendationsStep
            aiResult={analysisResult}
            decisionEngineResult={
              decisionEngineMutation.data?.decisionResult || null
            }
            isDecisionEngineLoading={decisionEngineMutation.isPending}
            isAILoading={analysisMutation.isPending}
            clientInfo={formData.client}
            healthInfo={formData.health}
            coverageRequest={formData.coverage}
            selectedTermYears={selectedTermYears}
            onTermChange={handleTermChange}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;
  const isAnalyzing =
    analysisMutation.isPending || decisionEngineMutation.isPending;
  const isSaving = saveSessionMutation.isPending;

  if (!acknowledged) {
    return (
      <UWWizardDisclaimerGate
        onAcknowledge={() => {
          sessionStorage.setItem("uw-wizard-acknowledged", "true");
          setAcknowledged(true);
        }}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <WizardPageLayout
        currentStep={currentStep.id}
        onStepClick={handleStepClick}
        canNavigateToStep={canNavigateToStep}
        onBack={() => navigate({ to: "/policies" })}
        headerRight={
          <>
            {/* Usage Badge */}
            {usageData && (
              <Badge
                variant={
                  usageStatus.status === "exceeded"
                    ? "destructive"
                    : usageStatus.status === "critical"
                      ? "destructive"
                      : usageStatus.status === "warning"
                        ? "outline"
                        : "secondary"
                }
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 ${
                  usageStatus.status === "warning"
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : ""
                }`}
              >
                <Zap className="h-3 w-3" />
                {usageData.runs_used}/{usageData.runs_limit}
              </Badge>
            )}

            {/* History Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistorySheet(true)}
              className="h-7 text-xs gap-1.5"
            >
              <History className="h-3 w-3" />
              History
            </Button>
          </>
        }
      >
        <div className="flex-1 overflow-hidden p-4">
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="min-h-0">
              <WizardInfoPanel
                currentStep={currentStep.id}
                formData={formData}
              />
            </div>

            <div className="min-h-0 overflow-hidden rounded-[28px] border border-border/70 bg-background/90 shadow-sm backdrop-blur-sm">
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-border/60 bg-gradient-to-r from-amber-50/80 via-background to-background px-5 py-4 dark:from-amber-950/20">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px] uppercase tracking-[0.16em]"
                    >
                      Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    >
                      Screening workflow
                    </Badge>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="text-lg font-semibold text-foreground"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        {currentStep.label}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {currentStep.description ||
                          "Capture accurate underwriting details before reviewing the results."}
                      </p>
                    </div>
                  </div>
                </div>

                {errors.submit && (
                  <div className="border-b border-red-200 bg-red-50/80 px-5 py-3 dark:border-red-800 dark:bg-red-950/20">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.submit}
                    </p>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
                  {renderStepContent()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-muted/50 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/policies" })}
            size="sm"
            className="h-8 text-xs px-3"
            disabled={isAnalyzing || isSaving}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStepIndex === 0 || isAnalyzing || isSaving}
              size="sm"
              className="h-8 text-xs px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSaveSession}
                disabled={
                  isSaving ||
                  !analysisResult ||
                  !decisionEngineMutation.data?.authoritativeRunEnvelope
                }
                size="sm"
                className="h-8 text-xs px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSaving ? "Saving..." : "Save Session"}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                size="sm"
                disabled={isAnalyzing}
                className="h-8 text-xs px-4 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {currentStep.id === "review" ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {isAnalyzing ? "Analyzing..." : "Get Recommendations"}
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </WizardPageLayout>

      {/* Session History Sheet */}
      <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm">Session History</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-3.5rem)]">
            <WizardSessionHistory
              onClose={() => setShowHistorySheet(false)}
              onLoadSession={handleLoadSession}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Limit Reached Dialog */}
      <UWLimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        usage={usageData ?? null}
      />
    </Suspense>
  );
}
