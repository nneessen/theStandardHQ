// supabase/functions/underwriting-ai-analyze/index.ts
// AI-Powered Underwriting Analysis Edge Function with Decision Tree Integration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";
import {
  evaluateDecisionTree,
  buildEvaluationContext,
  calculateTreeBoost,
  type DecisionTreeRules,
  type TreeEvaluationResult,
} from "./rule-evaluator.ts";
import {
  evaluateCriteriaForCarriers,
  buildCriteriaContext,
  FILTER_RULES as _FILTER_RULES, // Available for custom filtering
  type ExtractedCriteria,
  type CarrierCriteriaEntry,
  type CriteriaFilteredProduct,
  type CriteriaEvaluationResult,
} from "./criteria-evaluator.ts";

/**
 * Runtime validation for ExtractedCriteria JSON structure.
 * Ensures the criteria object has the expected shape before casting.
 */
function isValidCriteriaStructure(obj: unknown): obj is ExtractedCriteria {
  if (obj === null || typeof obj !== "object") {
    return false;
  }
  // Basic structure check - criteria is an object with optional known fields
  const criteria = obj as Record<string, unknown>;
  const validKeys = [
    "ageLimits",
    "faceAmountLimits",
    "knockoutConditions",
    "buildRequirements",
    "tobaccoRules",
    "medicationRestrictions",
    "stateAvailability",
  ];
  // All keys should be from the valid set (allow empty objects)
  const objKeys = Object.keys(criteria);
  return objKeys.every((key) => validKeys.includes(key));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConditionData {
  code: string;
  responses: Record<string, string | number | string[]>;
}

interface TobaccoInfo {
  currentUse: boolean;
  type?: string;
  frequency?: string;
  lastUseDate?: string;
}

interface MedicationInfo {
  bpMedCount: number;
  cholesterolMedCount: number;
  insulinUse: boolean;
  bloodThinners: boolean;
  antidepressants: boolean;
  painMedications: "none" | "otc_only" | "prescribed_non_opioid" | "opioid";
  otherMedications?: string[];
}

interface AnalysisRequest {
  client: {
    age: number;
    gender: string;
    state: string;
    bmi: number;
  };
  health: {
    conditions: ConditionData[];
    tobacco: TobaccoInfo;
    medications: MedicationInfo;
  };
  coverage: {
    faceAmount: number;
    productTypes: string[];
  };
  decisionTreeId?: string;
  imoId?: string; // For fetching relevant guides
  runKey?: string;
}

// Product underwriting constraints stored in metadata
interface AgeTier {
  minAge: number;
  maxAge: number;
  maxFaceAmount: number;
}

interface ProductUnderwritingConstraints {
  ageTieredFaceAmounts?: {
    tiers: AgeTier[];
  };
  knockoutConditions?: {
    conditionCodes: string[];
  };
  fullUnderwritingThreshold?: {
    faceAmountThreshold: number;
    ageBands?: Array<{
      minAge: number;
      maxAge: number;
      threshold: number;
    }>;
  };
}

interface ProductInfo {
  id: string;
  name: string;
  product_type: string;
  min_age: number | null;
  max_age: number | null;
  min_face_amount: number | null;
  max_face_amount: number | null;
  metadata: ProductUnderwritingConstraints | null;
}

interface CarrierInfo {
  id: string;
  name: string;
  products: ProductInfo[];
}

// Filtered out product tracking
interface FilteredProduct {
  productName: string;
  carrierName: string;
  reason: string;
}

interface GuideInfo {
  id: string;
  name: string;
  carrier_id: string;
  carrier_name: string;
  parsed_content: string | null;
  version: string | null;
}

interface ParsedGuideContent {
  fullText: string;
  sections: Array<{ pageNumber: number; content: string }>;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

// Token budget constants to prevent cost explosion
const MAX_TOTAL_GUIDE_CHARS = 15000; // Max chars across all guides combined
const MAX_EXCERPT_LENGTH = 1500; // Max chars per excerpt
const MAX_EXCERPTS_PER_GUIDE = 5;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ==========================================================================
    // FIX 4: JWT VERIFICATION AND TENANT OWNERSHIP VALIDATION
    // Previously: Auth header checked for existence only, imoId came from body.
    // Now: Verify JWT, get user identity, derive tenant from user_profiles.
    // ==========================================================================

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract JWT token
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid authorization header format",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create user client to verify JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify JWT and get authenticated user
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[Auth] JWT verification failed:", authError?.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or expired authentication token",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create service client for cross-table queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's IMO from profile (source of truth for tenant)
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("imo_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.imo_id) {
      console.error(
        "[Auth] User profile lookup failed:",
        profileError?.message,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "User profile not found or has no IMO assignment",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authenticatedImoId = userProfile.imo_id;

    // Parse request body
    const body: AnalysisRequest = await req.json();
    const {
      client,
      health,
      coverage,
      decisionTreeId,
      imoId: requestedImoId,
      runKey: requestedRunKey,
    } = body;
    const runKey =
      typeof requestedRunKey === "string" && requestedRunKey.trim().length > 0
        ? requestedRunKey.trim()
        : crypto.randomUUID();

    // CRITICAL: Validate imoId ownership - prevent cross-tenant access
    if (requestedImoId && requestedImoId !== authenticatedImoId) {
      console.warn(
        `[Auth] Cross-tenant access attempt blocked: User ${user.id} (IMO: ${authenticatedImoId}) requested IMO: ${requestedImoId}`,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Cannot access data for another organization",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use authenticated IMO for all tenant-scoped queries
    const imoId = authenticatedImoId;

    // ==========================================================================
    // USAGE QUOTA CHECK - Verify user has runs remaining before proceeding
    // ==========================================================================
    const { data: quotaCheck, error: quotaError } = await userClient.rpc(
      "can_run_uw_wizard",
      { p_user_id: user.id },
    );

    if (quotaError) {
      console.error("[Quota] Error checking quota:", quotaError.message);
      // Continue without blocking on quota check errors (graceful degradation)
    } else if (quotaCheck && quotaCheck.length > 0 && !quotaCheck[0].allowed) {
      const reason = quotaCheck[0].reason;
      console.log(
        `[Quota] User ${user.id} blocked: ${reason}, tier: ${quotaCheck[0].tier_id}`,
      );

      const errorMessages: Record<string, string> = {
        no_subscription: "UW Wizard subscription required",
        limit_exceeded:
          "Monthly usage limit reached. Upgrade your plan for more runs.",
      };

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessages[reason] || "Unable to verify usage quota",
          code: reason,
          runs_remaining: quotaCheck[0].runs_remaining || 0,
          tier_id: quotaCheck[0].tier_id,
        }),
        {
          status: reason === "no_subscription" ? 403 : 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate required fields
    if (!client || !client.age || !client.gender || !client.state) {
      throw new Error("Missing required client information");
    }

    // Fetch available carriers and products with underwriting constraints
    const { data: carriers, error: carriersError } = await supabase
      .from("carriers")
      .select(
        `
        id,
        name,
        products (
          id,
          name,
          product_type,
          min_age,
          max_age,
          min_face_amount,
          max_face_amount,
          metadata
        )
      `,
      )
      .eq("is_active", true);

    if (carriersError) {
      throw new Error(`Failed to fetch carriers: ${carriersError.message}`);
    }

    // Get client condition codes for knockout checking
    const clientConditionCodes = health.conditions.map((c) => c.code);

    // Helper function to get max face amount for age from age-tiered limits
    const getMaxFaceAmountForAge = (
      product: ProductInfo,
      clientAge: number,
    ): number | null => {
      const constraints = product.metadata;

      // Debug logging
      console.log(`[underwriting-ai] Checking age tiers for ${product.name}:`, {
        hasMetadata: !!constraints,
        hasAgeTieredFaceAmounts: !!constraints?.ageTieredFaceAmounts,
        tiers: constraints?.ageTieredFaceAmounts?.tiers,
        clientAge,
      });

      if (constraints?.ageTieredFaceAmounts?.tiers) {
        const tier = constraints.ageTieredFaceAmounts.tiers.find(
          (t: AgeTier) => clientAge >= t.minAge && clientAge <= t.maxAge,
        );
        if (tier) {
          console.log(
            `[underwriting-ai] Found matching tier for ${product.name}: age ${tier.minAge}-${tier.maxAge}, max $${tier.maxFaceAmount}`,
          );
          return tier.maxFaceAmount;
        } else {
          console.log(
            `[underwriting-ai] No matching tier for age ${clientAge} in ${product.name}`,
          );
        }
      }
      // Fall back to product-level max
      return product.max_face_amount;
    };

    // Helper function to check for knockout conditions
    const hasKnockoutCondition = (
      product: ProductInfo,
      conditionCodes: string[],
    ): string | null => {
      const constraints = product.metadata;
      if (!constraints?.knockoutConditions?.conditionCodes) {
        return null;
      }
      const knockout = conditionCodes.find((code) =>
        constraints.knockoutConditions!.conditionCodes.includes(code),
      );
      return knockout || null;
    };

    // Helper function to get full underwriting threshold
    const getFullUWThreshold = (
      product: ProductInfo,
      clientAge: number,
    ): number | null => {
      const constraints = product.metadata;

      // Debug logging
      console.log(
        `[underwriting-ai] Checking full UW threshold for ${product.name}:`,
        {
          hasMetadata: !!constraints,
          hasFullUWThreshold: !!constraints?.fullUnderwritingThreshold,
          threshold: constraints?.fullUnderwritingThreshold,
          clientAge,
        },
      );

      if (!constraints?.fullUnderwritingThreshold) {
        return null;
      }
      const threshold = constraints.fullUnderwritingThreshold;
      // Check age bands first
      if (threshold.ageBands) {
        const band = threshold.ageBands.find(
          (b: { minAge: number; maxAge: number; threshold: number }) =>
            clientAge >= b.minAge && clientAge <= b.maxAge,
        );
        if (band) {
          console.log(
            `[underwriting-ai] Full UW age band match for ${product.name}: age ${band.minAge}-${band.maxAge}, threshold $${band.threshold}`,
          );
          return band.threshold;
        }
      }
      console.log(
        `[underwriting-ai] Full UW base threshold for ${product.name}: $${threshold.faceAmountThreshold}`,
      );
      return threshold.faceAmountThreshold;
    };

    // Track filtered-out products with reasons
    const filteredOutProducts: FilteredProduct[] = [];

    // Track products requiring full underwriting (for informational purposes)
    const productsRequiringFullUW: string[] = [];

    // Filter products by eligibility criteria
    const eligibleCarriers: CarrierInfo[] = (carriers || [])
      .map((carrier) => ({
        id: carrier.id,
        name: carrier.name,
        products: ((carrier.products || []) as ProductInfo[]).filter(
          (product) => {
            // Filter by product type
            if (!coverage.productTypes.includes(product.product_type)) {
              return false; // Don't track - wrong product type is expected
            }

            // Filter by age eligibility
            if (product.min_age && client.age < product.min_age) {
              filteredOutProducts.push({
                productName: product.name,
                carrierName: carrier.name,
                reason: `Client age ${client.age} below minimum ${product.min_age}`,
              });
              return false;
            }
            if (product.max_age && client.age > product.max_age) {
              filteredOutProducts.push({
                productName: product.name,
                carrierName: carrier.name,
                reason: `Client age ${client.age} above maximum ${product.max_age}`,
              });
              return false;
            }

            // Filter by age-tiered face amount limits
            const maxFaceForAge = getMaxFaceAmountForAge(product, client.age);
            if (maxFaceForAge !== null && coverage.faceAmount > maxFaceForAge) {
              filteredOutProducts.push({
                productName: product.name,
                carrierName: carrier.name,
                reason: `Face amount $${coverage.faceAmount.toLocaleString()} exceeds age-tier max $${maxFaceForAge.toLocaleString()}`,
              });
              return false;
            }

            // Filter by knockout conditions
            const knockoutCondition = hasKnockoutCondition(
              product,
              clientConditionCodes,
            );
            if (knockoutCondition) {
              filteredOutProducts.push({
                productName: product.name,
                carrierName: carrier.name,
                reason: `Knockout condition: ${knockoutCondition}`,
              });
              return false;
            }

            // Basic face amount check (for products without age tiers)
            if (
              maxFaceForAge === null &&
              product.min_face_amount &&
              coverage.faceAmount < product.min_face_amount
            ) {
              filteredOutProducts.push({
                productName: product.name,
                carrierName: carrier.name,
                reason: `Face amount below minimum $${product.min_face_amount.toLocaleString()}`,
              });
              return false;
            }

            // FILTER OUT products requiring full underwriting at this face amount/age
            const fullUWThreshold = getFullUWThreshold(product, client.age);
            if (
              fullUWThreshold !== null &&
              coverage.faceAmount > fullUWThreshold
            ) {
              // Track for informational purposes
              productsRequiringFullUW.push(
                `${carrier.name} - ${product.name} (threshold: $${fullUWThreshold.toLocaleString()})`,
              );
              // Filter out - don't recommend fully underwritten products
              filteredOutProducts.push({
                productName: product.name,
                carrierName: carrier.name,
                reason: `Requires full underwriting above $${fullUWThreshold.toLocaleString()} (requested: $${coverage.faceAmount.toLocaleString()})`,
              });
              return false;
            }

            return true;
          },
        ),
      }))
      .filter((carrier) => carrier.products.length > 0);

    console.log(
      `[underwriting-ai] Found ${eligibleCarriers.length} carriers with eligible products. ` +
        `Filtered out ${filteredOutProducts.length} products for age ${client.age}, ` +
        `face amount $${coverage.faceAmount}, conditions: ${clientConditionCodes.join(", ") || "none"}. ` +
        `Full UW required: ${productsRequiringFullUW.length} products`,
    );

    // =========================================================================
    // PHASE 5: Fetch and apply active criteria from carrier_underwriting_criteria
    // =========================================================================
    const criteriaByCarrier = new Map<string, CarrierCriteriaEntry>();
    const criteriaFilteredProducts: CriteriaFilteredProduct[] = [];
    let criteriaEvaluationResults = new Map<string, CriteriaEvaluationResult>();

    if (imoId && eligibleCarriers.length > 0) {
      const carrierIds = eligibleCarriers.map((c) => c.id);

      // Fetch active criteria for eligible carriers
      const { data: activeCriteria, error: criteriaError } = await supabase
        .from("carrier_underwriting_criteria")
        .select("carrier_id, product_id, criteria")
        .eq("imo_id", imoId)
        .eq("is_active", true)
        .in("carrier_id", carrierIds);

      if (criteriaError) {
        console.warn(
          `[underwriting-ai] Failed to fetch criteria: ${criteriaError.message}`,
        );
      } else if (activeCriteria && activeCriteria.length > 0) {
        // Build criteria map by carrier with validation
        for (const c of activeCriteria) {
          const carrier = eligibleCarriers.find(
            (car) => car.id === c.carrier_id,
          );
          if (carrier && c.criteria) {
            // Validate criteria structure before using
            if (!isValidCriteriaStructure(c.criteria)) {
              console.warn(
                `[underwriting-ai] Invalid criteria structure for carrier ${carrier.name}, skipping`,
              );
              continue;
            }
            criteriaByCarrier.set(c.carrier_id, {
              carrierName: carrier.name,
              criteria: c.criteria,
              productId: c.product_id || undefined,
            });
          }
        }

        console.log(
          `[underwriting-ai] Found ${criteriaByCarrier.size} active criteria sets for ${carrierIds.length} carriers`,
        );

        // Apply criteria-based filtering with error handling
        // Wrapped in try-catch for graceful degradation - if criteria evaluation fails,
        // we fall back to AI-only analysis rather than failing the entire request
        if (criteriaByCarrier.size > 0) {
          try {
            const criteriaEvaluation = evaluateCriteriaForCarriers(
              criteriaByCarrier,
              { age: client.age, state: client.state, bmi: client.bmi },
              {
                conditions: health.conditions,
                tobacco: health.tobacco,
                medications: health.medications,
              },
              { faceAmount: coverage.faceAmount },
            );

            criteriaEvaluationResults = criteriaEvaluation.evaluationResults;

            // Add criteria-filtered products to tracking
            criteriaFilteredProducts.push(
              ...criteriaEvaluation.filteredProducts,
            );

            // Remove ineligible carriers from eligibleCarriers
            const ineligibleCarrierIds = new Set(
              criteriaEvaluation.filteredProducts.map((fp) => fp.carrierId),
            );

            // Filter out carriers that failed criteria checks
            for (let i = eligibleCarriers.length - 1; i >= 0; i--) {
              const carrier = eligibleCarriers[i];
              if (ineligibleCarrierIds.has(carrier.id)) {
                // Only remove if this carrier failed criteria AND has criteria defined
                // (don't remove carriers without criteria - they fall through to AI)
                if (criteriaByCarrier.has(carrier.id)) {
                  eligibleCarriers.splice(i, 1);
                }
              }
            }

            console.log(
              `[underwriting-ai] Criteria filtering: ${criteriaFilteredProducts.length} products filtered. ` +
                `${eligibleCarriers.length} carriers remain eligible.`,
            );
          } catch (evalError) {
            // Graceful degradation: log error and continue without criteria filtering
            console.error(
              `[underwriting-ai] Criteria evaluation failed, falling back to AI-only analysis:`,
              evalError,
            );
            // Clear criteria to indicate it wasn't applied
            criteriaByCarrier.clear();
            criteriaEvaluationResults.clear();
          }
        }
      }
    }

    // Fetch decision tree rules if specified, or get the default active tree for the IMO
    let decisionTreeRules: DecisionTreeRules | null = null;
    let treeEvaluationResult: TreeEvaluationResult | null = null;

    // Try specified tree first, then fall back to IMO's default active tree
    if (decisionTreeId) {
      // FIX 4: Add IMO validation to prevent accessing other orgs' decision trees
      const { data: treeData, error: treeError } = await supabase
        .from("underwriting_decision_trees")
        .select("rules")
        .eq("id", decisionTreeId)
        .eq("imo_id", imoId) // CRITICAL: Ensure tree belongs to user's IMO
        .single();

      if (treeError) {
        console.warn(
          `[DecisionTree] Access denied or tree not found: ${decisionTreeId} for IMO ${imoId}`,
        );
        // Continue without tree rather than exposing error details
      } else if (treeData?.rules) {
        decisionTreeRules = treeData.rules as DecisionTreeRules;
      }
    } else if (imoId) {
      // Get the default active tree for this IMO
      const { data: defaultTree } = await supabase
        .from("underwriting_decision_trees")
        .select("rules")
        .eq("imo_id", imoId)
        .eq("is_active", true)
        .eq("is_default", true)
        .single();

      if (defaultTree?.rules) {
        decisionTreeRules = defaultTree.rules as DecisionTreeRules;
      }
    }

    // Evaluate decision tree rules BEFORE AI call (deterministic routing)
    if (decisionTreeRules?.rules && decisionTreeRules.rules.length > 0) {
      const evaluationContext = buildEvaluationContext(
        client,
        health,
        coverage,
      );
      treeEvaluationResult = evaluateDecisionTree(
        decisionTreeRules.rules,
        evaluationContext,
      );

      console.log(
        `[underwriting-ai] Decision tree evaluation: ${treeEvaluationResult.metadata.totalMatches}/${treeEvaluationResult.metadata.totalRulesEvaluated} rules matched ` +
          `in ${treeEvaluationResult.metadata.evaluationTimeMs}ms. ` +
          `Primary routing: [${treeEvaluationResult.metadata.primaryRoutingMatches.join(", ")}]`,
      );
    }

    // Fetch parsed guides for eligible carriers
    const carrierGuides: Map<string, GuideInfo[]> = new Map();
    if (imoId && eligibleCarriers.length > 0) {
      const carrierIds = eligibleCarriers.map((c) => c.id);
      const { data: guidesData } = await supabase
        .from("underwriting_guides")
        .select(
          `
          id,
          name,
          carrier_id,
          parsed_content,
          version,
          carriers!underwriting_guides_carrier_id_fkey (name)
        `,
        )
        .eq("imo_id", imoId)
        .eq("parsing_status", "completed")
        .in("carrier_id", carrierIds);

      if (guidesData && guidesData.length > 0) {
        for (const guide of guidesData) {
          const carrierName =
            (guide.carriers as { name: string } | null)?.name || "Unknown";
          const guideInfo: GuideInfo = {
            id: guide.id,
            name: guide.name,
            carrier_id: guide.carrier_id,
            carrier_name: carrierName,
            parsed_content: guide.parsed_content,
            version: guide.version,
          };

          const existing = carrierGuides.get(guide.carrier_id) || [];
          existing.push(guideInfo);
          carrierGuides.set(guide.carrier_id, existing);
        }
        console.log(
          `[underwriting-ai] Found ${guidesData.length} parsed guides for analysis`,
        );
      }
    }

    // Fetch health condition names for context
    const conditionCodes = health.conditions.map((c) => c.code);
    let conditionNames: Record<string, string> = {};
    if (conditionCodes.length > 0) {
      const { data: conditionsData } = await supabase
        .from("underwriting_health_conditions")
        .select("code, name")
        .in("code", conditionCodes);

      if (conditionsData) {
        conditionNames = conditionsData.reduce(
          (acc, c) => ({ ...acc, [c.code]: c.name }),
          {},
        );
      }
    }

    // Build the AI prompt with tree evaluation context and criteria
    const systemPrompt = buildSystemPrompt(
      eligibleCarriers,
      decisionTreeRules,
      carrierGuides,
      health.conditions.map((c) => conditionNames[c.code] || c.code),
      client.age,
      treeEvaluationResult,
      criteriaByCarrier, // Phase 5: Include structured criteria
    );
    const userPrompt = buildUserPrompt(
      client,
      health,
      coverage,
      conditionNames,
    );

    // Call Claude API
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Parse AI response
    const aiContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    // Merge tree evaluation results with AI recommendations (hybrid scoring)
    let mergedRecommendations = analysisResult.recommendations || [];
    if (treeEvaluationResult && treeEvaluationResult.matchedRules.length > 0) {
      mergedRecommendations = mergedRecommendations.map(
        (rec: {
          carrier_id: string;
          product_id: string;
          confidence: number;
          notes?: string;
        }) => {
          const { boost, matchedRules } = calculateTreeBoost(
            rec.carrier_id,
            rec.product_id,
            treeEvaluationResult!,
          );

          return {
            ...rec,
            confidence: Math.min(1.0, rec.confidence + boost),
            tree_match_boost: boost,
            tree_matched_rules: matchedRules,
            notes:
              matchedRules.length > 0
                ? `${rec.notes || ""} [Tree: ${matchedRules.join(", ")}]`.trim()
                : rec.notes,
          };
        },
      );

      // Re-sort by boosted confidence
      mergedRecommendations.sort(
        (a: { confidence: number }, b: { confidence: number }) =>
          b.confidence - a.confidence,
      );

      // Re-assign priorities based on new order
      mergedRecommendations.forEach(
        (rec: { priority: number }, idx: number) => {
          rec.priority = idx + 1;
        },
      );

      // Update reasoning to include tree info
      analysisResult.reasoning = `${analysisResult.reasoning || ""} [Decision tree matched ${treeEvaluationResult.metadata.totalMatches} rules: ${treeEvaluationResult.metadata.primaryRoutingMatches.join(", ") || "none primary"}]`;
    }

    // Update analysis result with merged recommendations
    analysisResult.recommendations = mergedRecommendations;

    // ==========================================================================
    // INCREMENT USAGE - Track this run for billing/quota purposes
    // ==========================================================================
    const tokenUsage = {
      input: response.usage?.input_tokens || null,
      output: response.usage?.output_tokens || null,
    };

    let usageInfo = null;
    let usageRecorded = false;
    try {
      const { data: incrementResult } = await userClient.rpc(
        "record_uw_wizard_run",
        {
          p_imo_id: imoId,
          p_run_key: runKey,
          p_session_id: null, // Could pass session ID if saving
          p_input_tokens: tokenUsage.input,
          p_output_tokens: tokenUsage.output,
        },
      );

      if (
        incrementResult &&
        incrementResult.length > 0 &&
        incrementResult[0].success
      ) {
        usageRecorded = true;

        // Get full usage info for response
        const { data: currentUsage } = await userClient.rpc(
          "get_uw_wizard_usage",
          { p_user_id: user.id },
        );

        if (currentUsage && currentUsage.length > 0) {
          usageInfo = {
            runs_used: currentUsage[0].runs_used,
            runs_limit: currentUsage[0].runs_limit,
            runs_remaining: currentUsage[0].runs_remaining,
            usage_percent: currentUsage[0].usage_percent,
            tier_id: currentUsage[0].tier_id,
            tier_name: currentUsage[0].tier_name,
          };
        }
      }

      console.log(
        `[Usage] User ${user.id} run recorded. Tokens: ${tokenUsage.input}/${tokenUsage.output}. ` +
          `Remaining: ${usageInfo?.runs_remaining ?? "unknown"}`,
      );
    } catch (usageError) {
      console.error("[Usage] Failed to increment usage:", usageError);
      // Continue without blocking - usage tracking is non-critical
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisResult,
        usage: usageInfo,
        usageRecorded,
        filteredProducts: filteredOutProducts,
        fullUnderwritingRequired: productsRequiringFullUW,
        // Phase 5: Include criteria evaluation results
        criteriaFilters: {
          applied: criteriaByCarrier.size > 0,
          matchedCarriers: Array.from(criteriaByCarrier.keys()),
          filteredByCarrier: criteriaFilteredProducts,
          evaluationResults: Object.fromEntries(
            Array.from(criteriaEvaluationResults.entries()).map(
              ([id, result]) => [
                id,
                {
                  eligible: result.eligible,
                  reasons: result.reasons,
                  buildRating: result.buildRating,
                  tobaccoClass: result.tobaccoClass,
                },
              ],
            ),
          ),
        },
        treeEvaluation: treeEvaluationResult
          ? {
              matchedRules: treeEvaluationResult.matchedRules.map((r) => ({
                ruleName: r.ruleName,
                matchScore: r.matchScore,
                matchedConditions: r.matchedConditions,
              })),
              totalMatches: treeEvaluationResult.metadata.totalMatches,
              evaluationTimeMs: treeEvaluationResult.metadata.evaluationTimeMs,
            }
          : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Underwriting analysis error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Analysis failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function buildSystemPrompt(
  carriers: CarrierInfo[],
  decisionTreeRules: DecisionTreeRules | null,
  carrierGuides: Map<string, GuideInfo[]>,
  clientConditions: string[],
  clientAge?: number,
  treeEvaluation?: TreeEvaluationResult | null,
  criteriaByCarrier?: Map<string, CarrierCriteriaEntry>, // Phase 5: Structured criteria
): string {
  const carrierList = carriers
    .map(
      (c) =>
        `- ${c.name} (ID: ${c.id}): Products: ${c.products
          .map((p) => {
            const limits: string[] = [];
            if (p.min_age || p.max_age) {
              limits.push(`ages ${p.min_age || 0}-${p.max_age || 99}`);
            }
            if (p.min_face_amount || p.max_face_amount) {
              const min = p.min_face_amount
                ? `$${p.min_face_amount.toLocaleString()}`
                : "$0";
              const max = p.max_face_amount
                ? `$${p.max_face_amount.toLocaleString()}`
                : "unlimited";
              limits.push(`face ${min}-${max}`);
            }
            // Include full underwriting threshold if present
            const constraints = p.metadata;
            if (constraints?.fullUnderwritingThreshold) {
              let threshold =
                constraints.fullUnderwritingThreshold.faceAmountThreshold;
              // Check for age-specific threshold
              if (clientAge && constraints.fullUnderwritingThreshold.ageBands) {
                const band =
                  constraints.fullUnderwritingThreshold.ageBands.find(
                    (b) => clientAge >= b.minAge && clientAge <= b.maxAge,
                  );
                if (band) {
                  threshold = band.threshold;
                }
              }
              limits.push(`full UW above $${threshold.toLocaleString()}`);
            }
            const limitStr = limits.length > 0 ? ` (${limits.join(", ")})` : "";
            return `${p.name} [${p.product_type}]${limitStr} (ID: ${p.id})`;
          })
          .join(", ")}`,
    )
    .join("\n");

  // Build decision tree section with evaluation results
  let rulesSection = "";
  if (treeEvaluation && treeEvaluation.matchedRules.length > 0) {
    // Include evaluated rules with their match status
    const matchedRulesSummary = treeEvaluation.matchedRules
      .map(
        (r) => `- ${r.ruleName}: Matched (${r.matchedConditions.join(", ")})`,
      )
      .join("\n");

    const recommendedCarriers = treeEvaluation.recommendedCarrierIds
      .map((id) => {
        const carrier = carriers.find((c) => c.id === id);
        return carrier ? carrier.name : id;
      })
      .join(", ");

    rulesSection = `
DECISION TREE EVALUATION RESULTS (Pre-analyzed - PRIORITIZE these recommendations):
The following rules have been deterministically evaluated and matched this client:

${matchedRulesSummary}

TREE-RECOMMENDED CARRIERS: ${recommendedCarriers || "None specific"}

IMPORTANT: Prioritize recommendations for tree-recommended carriers.
They have been pre-screened as good matches based on age, face amount, and health criteria.
`;
  } else if (decisionTreeRules?.rules) {
    // Fallback: Include raw rules if no evaluation happened
    rulesSection = `
DECISION TREE RULES (Reference for matching criteria):
${JSON.stringify(decisionTreeRules.rules.slice(0, 5), null, 2)}
${decisionTreeRules.rules.length > 5 ? `... and ${decisionTreeRules.rules.length - 5} more rules` : ""}
`;
  }

  // Build guide context section with token budget enforcement
  let guidesSection = "";
  if (carrierGuides.size > 0) {
    const guideEntries: string[] = [];
    let totalGuideChars = 0;

    for (const [_carrierId, guides] of carrierGuides) {
      // Stop if we've exceeded total budget
      if (totalGuideChars >= MAX_TOTAL_GUIDE_CHARS) {
        console.log(
          `[underwriting-ai] Token budget exhausted at ${totalGuideChars} chars`,
        );
        break;
      }

      for (const guide of guides) {
        if (!guide.parsed_content) continue;

        // Stop if budget exhausted
        if (totalGuideChars >= MAX_TOTAL_GUIDE_CHARS) break;

        // Parse and validate guide content with error handling
        let content: ParsedGuideContent;
        try {
          const parsed = JSON.parse(guide.parsed_content);

          // Validate required structure
          if (!parsed || typeof parsed !== "object") {
            console.warn(
              `[underwriting-ai] Invalid guide content for ${guide.name}: not an object`,
            );
            continue;
          }
          if (!Array.isArray(parsed.sections)) {
            console.warn(
              `[underwriting-ai] Invalid guide content for ${guide.name}: sections not an array`,
            );
            continue;
          }

          content = parsed as ParsedGuideContent;
        } catch (parseError) {
          console.warn(
            `[underwriting-ai] Failed to parse guide content for ${guide.name}:`,
            parseError,
          );
          continue;
        }

        // Extract relevant excerpts with remaining budget
        const remainingBudget = MAX_TOTAL_GUIDE_CHARS - totalGuideChars;
        const relevantExcerpts = extractRelevantExcerpts(
          content,
          clientConditions,
          remainingBudget,
        );

        if (relevantExcerpts.length > 0) {
          const excerptText = relevantExcerpts.join("\n\n");
          totalGuideChars += excerptText.length;

          const versionInfo = guide.version ? ` (v${guide.version})` : "";
          guideEntries.push(
            `### ${guide.carrier_name} - ${guide.name}${versionInfo}\n${excerptText}`,
          );
        }
      }
    }

    if (guideEntries.length > 0) {
      guidesSection = `
CARRIER UNDERWRITING GUIDE EXCERPTS:
Use this carrier-specific information to make more accurate recommendations.
Reference these guides when relevant to increase confidence in your assessment.

${guideEntries.join("\n\n---\n\n")}
`;
    }

    console.log(
      `[underwriting-ai] Total guide content: ${totalGuideChars} chars from ${guideEntries.length} guides`,
    );
  }

  // Phase 5: Build structured criteria context (more efficient than raw excerpts)
  let criteriaSection = "";
  if (criteriaByCarrier && criteriaByCarrier.size > 0) {
    const criteriaContext = buildCriteriaContext(criteriaByCarrier);
    if (criteriaContext) {
      criteriaSection = `
CARRIER-SPECIFIC UNDERWRITING CRITERIA (Pre-validated and verified):
The following criteria have been extracted from carrier underwriting guides and verified by human review.
These are authoritative rules - use them to inform your recommendations with high confidence.

${criteriaContext}

NOTE: Carriers with criteria above have already been filtered for eligibility based on these rules.
Only recommend products from carriers that passed the criteria checks.
`;
      console.log(
        `[underwriting-ai] Added criteria context for ${criteriaByCarrier.size} carriers`,
      );
    }
  }

  return `You are an expert insurance underwriter assistant specializing in life insurance. Your role is to analyze client health profiles and provide carrier/product recommendations.

AVAILABLE CARRIERS AND PRODUCTS:
${carrierList}
${rulesSection}${criteriaSection}${guidesSection}
UNDERWRITING GUIDELINES:
1. Consider client age, health conditions, tobacco use, BMI, and medication usage
2. Preferred/Preferred Plus ratings typically require:
   - No tobacco use (at least 3-5 years clean)
   - BMI between 18.5-30
   - No major health conditions or well-controlled conditions
   - Normal blood pressure (1 or fewer BP medications)

3. Standard ratings are typical for:
   - Well-controlled chronic conditions
   - BMI 30-35
   - 1-2 BP medications
   - Former tobacco users (1-3 years clean)

4. Substandard/Table ratings for:
   - Multiple or poorly controlled conditions
   - BMI > 35
   - 3+ BP medications
   - Recent tobacco use
   - Significant health history

5. Decline considerations:
   - Active cancer (except certain early-stage/cured)
   - Severe heart disease
   - End-stage conditions
   - Active substance abuse

RESPONSE FORMAT:
You MUST respond with ONLY a JSON object in this exact format (no other text):
{
  "health_tier": "preferred_plus|preferred|standard_plus|standard|substandard|table_rated|decline",
  "risk_factors": ["factor1", "factor2"],
  "recommendations": [
    {
      "carrier_id": "uuid",
      "carrier_name": "Carrier Name",
      "product_id": "uuid",
      "product_name": "Product Name",
      "expected_rating": "Preferred|Standard|Table 2-4|Decline",
      "confidence": 0.0-1.0,
      "key_factors": ["positive factor 1", "positive factor 2"],
      "concerns": ["concern 1"],
      "priority": 1,
      "guide_references": ["Guide name - relevant section/page if known"]
    }
  ],
  "reasoning": "Brief explanation of analysis (2-3 sentences)"
}

Important:
- Always include at least 1-3 recommendations unless the client should be declined
- Use actual carrier_id and product_id from the AVAILABLE CARRIERS list
- Confidence should reflect how certain you are about the rating
- Priority 1 = best match, higher numbers = lower priority
- Be conservative with ratings - it's better to under-promise
- Include guide_references when your recommendation is informed by carrier guide content`;
}

/**
 * Extract relevant excerpts from parsed guide content based on client conditions.
 * Uses targeted keyword matching to find sections that mention the client's health conditions.
 * Enforces a character budget to prevent token explosion.
 */
function extractRelevantExcerpts(
  content: ParsedGuideContent,
  conditions: string[],
  charBudget: number,
): string[] {
  const excerpts: string[] = [];
  let usedChars = 0;

  // Focus on condition-specific keywords only - avoid overly generic terms
  // that would match nearly every page and explode token usage
  const conditionKeywords = conditions.map((t) => t.toLowerCase());

  // Only include specific underwriting terms, not generic ones like "underwriting", "rating", etc.
  const specificKeywords = [
    "build chart",
    "table rating",
    "decline",
    "tobacco class",
    "nicotine",
    "smoker",
    "non-smoker",
    "bmi chart",
    "height weight",
  ];

  const _searchTerms = [...conditionKeywords, ...specificKeywords];

  // Prioritize sections that match client conditions over generic matches
  const scoredSections = content.sections.map((section) => {
    const sectionLower = section.content.toLowerCase();
    let score = 0;
    const matchedTerms: string[] = [];

    // Higher score for condition matches
    for (const term of conditionKeywords) {
      if (sectionLower.includes(term)) {
        score += 10;
        matchedTerms.push(term);
      }
    }

    // Lower score for specific keyword matches
    for (const term of specificKeywords) {
      if (sectionLower.includes(term)) {
        score += 2;
        matchedTerms.push(term);
      }
    }

    return { section, score, matchedTerms };
  });

  // Sort by relevance score (highest first)
  scoredSections.sort((a, b) => b.score - a.score);

  // Take top relevant sections within budget
  for (const {
    section,
    score,
    matchedTerms: _matchedTerms,
  } of scoredSections) {
    if (excerpts.length >= MAX_EXCERPTS_PER_GUIDE) break;
    if (usedChars >= charBudget) break;
    if (score === 0) break; // No matches, stop

    // Truncate if needed to fit budget
    let excerpt = section.content;
    const remainingBudget = charBudget - usedChars;
    const maxForExcerpt = Math.min(MAX_EXCERPT_LENGTH, remainingBudget);

    if (excerpt.length > maxForExcerpt) {
      excerpt = excerpt.substring(0, maxForExcerpt) + "...";
    }

    excerpts.push(`[Page ${section.pageNumber}]: ${excerpt}`);
    usedChars += excerpt.length;
  }

  return excerpts;
}

function buildUserPrompt(
  client: AnalysisRequest["client"],
  health: AnalysisRequest["health"],
  coverage: AnalysisRequest["coverage"],
  conditionNames: Record<string, string>,
): string {
  const conditionsText =
    health.conditions.length > 0
      ? health.conditions
          .map((c) => {
            const name = conditionNames[c.code] || c.code;
            const details = Object.entries(c.responses)
              .map(
                ([key, val]) =>
                  `  - ${key}: ${Array.isArray(val) ? val.join(", ") : val}`,
              )
              .join("\n");
            return `- ${name}:\n${details}`;
          })
          .join("\n\n")
      : "No health conditions reported";

  const tobaccoText = health.tobacco.currentUse
    ? `Yes - ${health.tobacco.type || "unspecified"} (${health.tobacco.frequency || "frequency unknown"})`
    : "No current tobacco/nicotine use";

  const bmiCategory =
    client.bmi < 18.5
      ? "Underweight"
      : client.bmi < 25
        ? "Normal"
        : client.bmi < 30
          ? "Overweight"
          : client.bmi < 35
            ? "Obese Class I"
            : client.bmi < 40
              ? "Obese Class II"
              : "Obese Class III";

  return `Analyze this client for life insurance underwriting:

CLIENT PROFILE:
- Age: ${client.age}
- Gender: ${client.gender}
- State: ${client.state}
- BMI: ${client.bmi} (${bmiCategory})

HEALTH CONDITIONS:
${conditionsText}

TOBACCO/NICOTINE USE:
${tobaccoText}

MEDICATIONS:
- Blood Pressure Medications: ${health.medications.bpMedCount}
- Cholesterol Medications: ${health.medications.cholesterolMedCount}
- Insulin Use: ${health.medications.insulinUse ? "Yes" : "No"}
- Blood Thinners: ${health.medications.bloodThinners ? "Yes" : "No"}
- Antidepressants: ${health.medications.antidepressants ? "Yes" : "No"}
- Pain Medications: ${health.medications.painMedications === "none" ? "None" : health.medications.painMedications === "otc_only" ? "OTC only" : health.medications.painMedications === "prescribed_non_opioid" ? "Prescribed non-opioid" : "Opioid"}

COVERAGE REQUEST:
- Face Amount: $${coverage.faceAmount.toLocaleString()}
- Product Types: ${coverage.productTypes.join(", ")}

Based on this profile, provide your underwriting assessment and carrier recommendations in the required JSON format.`;
}
