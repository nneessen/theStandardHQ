const NEGATIVE_REPLY_PATTERNS = [
  /^no$/i,
  /^nope$/i,
  /^nah$/i,
  /^not interested\b/i,
  /^no thanks\b/i,
  /^not now\b/i,
];

const OPT_OUT_REPLY_PATTERNS = [
  /^stop\b/i,
  /^unsubscribe\b/i,
  /^end\b/i,
  /^quit\b/i,
  /^cancel\b/i,
  /^remove me\b/i,
];

const TIMEZONE_ABBREVIATION_TO_IANA = {
  EST: "America/New_York",
  EDT: "America/New_York",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
};

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function truncate(text, max = 160) {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function formatClockTime(dateValue, timeZone) {
  const date = parseDate(dateValue);
  if (!date || !timeZone) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return formatter.format(date).replace(/\s/g, " ").toUpperCase();
}

function extractExplicitTimezoneAvailability(messages = []) {
  const candidates = [];

  for (const message of messages) {
    const content = message.content || "";
    const normalizedContent = content.replace(/\s+/g, " ").trim();
    const timezoneMatch = normalizedContent.match(
      /\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/i,
    );
    const timeMatch = normalizedContent.match(/\b(\d{1,2}:\d{2}\s*[AP]M)\b/i);

    if (!timezoneMatch || !timeMatch) continue;

    const abbreviation = timezoneMatch[1].toUpperCase();
    const timeText = timeMatch[1].toUpperCase().replace(/\s+/g, " ");
    const timeZone = TIMEZONE_ABBREVIATION_TO_IANA[abbreviation] ?? null;

    candidates.push({
      createdAt: message.createdAt,
      abbreviation,
      timeText,
      timeZone,
      content: normalizedContent,
    });
  }

  return candidates;
}

function extractReminderTimes(messages = []) {
  return messages
    .filter(
      (message) =>
        message.direction === "outbound" &&
        /reminder|heads up|coming up today/i.test(message.content || ""),
    )
    .map((message) => {
      const timeMatch = (message.content || "").match(
        /\b(\d{1,2}:\d{2}\s?[AP]M)\b/i,
      );

      return {
        createdAt: message.createdAt,
        content: message.content || "",
        timeText: timeMatch
          ? timeMatch[1].toUpperCase().replace(/\s+/g, " ")
          : null,
      };
    })
    .filter((item) => item.timeText);
}

function titleCaseFromCode(code) {
  return code
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sortByCreatedAt(messages = []) {
  return [...messages].sort((left, right) => {
    const leftTime = parseDate(left.createdAt)?.getTime() ?? 0;
    const rightTime = parseDate(right.createdAt)?.getTime() ?? 0;
    return leftTime - rightTime;
  });
}

function summarizeAgentStatus(agentBundle) {
  const status = agentBundle?.status ?? {};
  const usage = agentBundle?.agent?.usage ?? {};

  return {
    isActive: status.isActive === true,
    botEnabled: status.botEnabled === true,
    closeConnected: status.closeConnected === true,
    calendarConnected:
      status.calendlyConnected === true || status.googleConnected === true,
    leadLimitReached:
      typeof usage.leadLimit === "number" &&
      usage.leadLimit > 0 &&
      typeof usage.leadCount === "number" &&
      usage.leadCount >= usage.leadLimit,
  };
}

function buildFinding({
  code,
  severity,
  priority,
  summary,
  evidence = [],
  inference = false,
  codePath = null,
}) {
  const finding = { code, severity, priority, summary, evidence, inference };
  if (codePath) finding.codePath = codePath;
  return finding;
}

// --- Utility functions for deep analysis ---

function tokenize(text) {
  if (!text) return new Set();
  return new Set(text.toLowerCase().match(/\b\w+\b/g) || []);
}

function jaccardSimilarity(textA, textB) {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function isIntroPattern(text) {
  if (!text) return false;
  return /^(hi|hey|hello|good\s+(morning|afternoon|evening))\b.*\bthis is\b/i.test(text.trim());
}

function containsPriceLanguage(text) {
  if (!text) return false;
  return /\$\d|(?:^|\s)(premium|rate|cost|quote|price|pricing)\b/i.test(text);
}

function containsLifeInsuranceLabel(text) {
  if (!text) return false;
  return /life insurance/i.test(text);
}

function containsDobRequest(text) {
  if (!text) return false;
  return /\b(DOB|date of birth|birthday|birth date|how old|your age)\b/i.test(text);
}

function containsBookingConfirmationLanguage(text) {
  if (!text) return false;
  return /\b(you'?re all set|booked|confirmed|appointment is set|scheduled for you)\b/i.test(text);
}

function containsEmojiCharacters(text) {
  if (!text) return false;
  try {
    return /\p{Extended_Pictographic}/u.test(text);
  } catch {
    return false;
  }
}

function isTruncated(text) {
  if (!text || text.trim().length === 0) return false;
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  // Complete-looking short messages are not truncated
  if (/[.!?…"')}\]]$/.test(trimmed)) return false;
  // Common short phrases (greetings, interjections) are not truncated
  if (words.length <= 2 && trimmed.length <= 15) return false;
  // Ends mid-word with a very short trailing fragment (1-3 lowercase chars), no terminal punctuation
  if (/\w$/.test(trimmed)) {
    const lastWord = words[words.length - 1] || "";
    if (lastWord.length <= 3 && /^[a-z]/.test(lastWord)) return true;
  }
  return false;
}

function containsMarkdown(text) {
  if (!text) return false;
  return /\*\*|##|^- /m.test(text);
}

function parseTimezoneHour(dateString, timezone) {
  if (!dateString || !timezone) return null;
  const date = parseDate(dateString);
  if (!date) return null;
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(date),
    );
    return hour;
  } catch {
    return null;
  }
}

// --- Six Analysis Passes ---

function analyzeRepetition({ outboundMessages }) {
  const findings = [];

  // Repeated outbound content (Jaccard > 0.7)
  const longOutbound = outboundMessages.filter((m) => (m.content || "").length >= 20);
  const repeatedPairs = [];
  for (let i = 0; i < longOutbound.length; i++) {
    for (let j = i + 1; j < longOutbound.length; j++) {
      if (jaccardSimilarity(longOutbound[i].content, longOutbound[j].content) > 0.7) {
        repeatedPairs.push([longOutbound[i], longOutbound[j]]);
      }
    }
  }
  if (repeatedPairs.length > 0) {
    findings.push(
      buildFinding({
        code: "repeated_outbound_content",
        severity: "warning",
        priority: 65,
        summary: `${repeatedPairs.length} pair${repeatedPairs.length === 1 ? "" : "s"} of outbound messages have highly similar content (Jaccard > 0.7).`,
        evidence: repeatedPairs.slice(0, 3).map(
          ([a, b]) => `"${truncate(a.content, 80)}" ~ "${truncate(b.content, 80)}"`,
        ),
        codePath: "ai-helpers.ts > enforceReplyGuardrails()",
      }),
    );
  }

  // Repeated intro messages
  const introMessages = outboundMessages.filter((m) => isIntroPattern(m.content));
  if (introMessages.length >= 2) {
    findings.push(
      buildFinding({
        code: "repeated_intro_messages",
        severity: "warning",
        priority: 60,
        summary: `${introMessages.length} outbound messages match the intro pattern ("Hi/Hey X, this is...").`,
        evidence: introMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "ai-helpers.ts > stripRedundantIntro()",
      }),
    );
  }

  // Repeated fallback reply
  const fallbackCounts = {};
  for (const m of outboundMessages) {
    if (m.fallbackKind) {
      fallbackCounts[m.fallbackKind] = (fallbackCounts[m.fallbackKind] || 0) + 1;
    }
  }
  for (const [kind, count] of Object.entries(fallbackCounts)) {
    if (count >= 3) {
      findings.push(
        buildFinding({
          code: "repeated_fallback_reply",
          severity: "warning",
          priority: 62,
          summary: `Fallback kind "${kind}" used ${count} times across outbound messages.`,
          evidence: [`\`fallbackKind="${kind}"\` appeared on ${count} outbound messages.`],
          codePath: "ai-helpers.ts > buildNonSilentReplyFallback()",
        }),
      );
    }
  }

  // Repeated qualification topic
  const qualViolationMessages = outboundMessages.filter(
    (m) => Array.isArray(m.guardrailViolations) && m.guardrailViolations.includes("repeated_qualification_question"),
  );
  if (qualViolationMessages.length >= 2) {
    findings.push(
      buildFinding({
        code: "repeated_qualification_topic",
        severity: "warning",
        priority: 58,
        summary: `${qualViolationMessages.length} outbound messages flagged for repeated qualification questions.`,
        evidence: qualViolationMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: guardrailViolations includes "repeated_qualification_question"`,
        ),
        codePath: "ai-helpers.ts > deriveConversationMemory()",
      }),
    );
  }

  return findings;
}

function analyzeMessageQuality({ outboundMessages }) {
  const findings = [];

  // Truncated messages
  const truncatedMessages = outboundMessages.filter((m) => isTruncated(m.content));
  for (const m of truncatedMessages) {
    findings.push(
      buildFinding({
        code: "truncated_message",
        severity: "critical",
        priority: 78,
        summary: `Outbound message appears truncated: "${truncate(m.content, 60)}".`,
        evidence: [
          `At \`${m.createdAt}\`: "${truncate(m.content, 120)}" — ends mid-word or lacks terminal punctuation.`,
        ],
        codePath: "CRM send path",
      }),
    );
  }

  // Markdown in SMS
  const markdownMessages = outboundMessages.filter((m) => containsMarkdown(m.content));
  if (markdownMessages.length > 0) {
    findings.push(
      buildFinding({
        code: "markdown_in_sms",
        severity: "warning",
        priority: 42,
        summary: `${markdownMessages.length} outbound message${markdownMessages.length === 1 ? "" : "s"} contain markdown formatting (**, ##, or list markers).`,
        evidence: markdownMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "sanitize-sms.ts > sanitizeSmsReply()",
      }),
    );
  }

  // Wall of text
  const longMessages = outboundMessages.filter((m) => (m.content || "").length > 320);
  if (longMessages.length > 0) {
    findings.push(
      buildFinding({
        code: "wall_of_text",
        severity: "warning",
        priority: 38,
        summary: `${longMessages.length} outbound message${longMessages.length === 1 ? "" : "s"} exceed 320 characters.`,
        evidence: longMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: ${(m.content || "").length} chars — "${truncate(m.content, 80)}"`,
        ),
        codePath: "Prompt construction",
      }),
    );
  }

  // Emoji in outbound
  const emojiMessages = outboundMessages.filter((m) => containsEmojiCharacters(m.content));
  if (emojiMessages.length > 0) {
    findings.push(
      buildFinding({
        code: "emoji_in_outbound",
        severity: "info",
        priority: 20,
        summary: `${emojiMessages.length} outbound message${emojiMessages.length === 1 ? "" : "s"} contain emoji characters.`,
        evidence: emojiMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "sanitize-sms.ts > sanitizeSmsReply()",
      }),
    );
  }

  return findings;
}

function analyzeConversationFlow({ normalizedMessages, outboundMessages, inboundMessages, agentBundle }) {
  const findings = [];

  // Outbound spam ratio
  if (outboundMessages.length >= 5 && inboundMessages.length > 0) {
    const ratio = outboundMessages.length / inboundMessages.length;
    if (ratio >= 5) {
      findings.push(
        buildFinding({
          code: "outbound_spam_ratio",
          severity: "warning",
          priority: 72,
          summary: `Outbound-to-inbound ratio is ${ratio.toFixed(1)}:1 (${outboundMessages.length} outbound, ${inboundMessages.length} inbound).`,
          evidence: [
            `${outboundMessages.length} outbound vs ${inboundMessages.length} inbound messages.`,
          ],
          codePath: "Intro + follow-up handlers",
        }),
      );
    }
  }

  // Conversation stuck — 3+ consecutive outbound with same replyCategory
  const consecutiveRuns = [];
  let currentRun = [];
  for (const m of normalizedMessages) {
    if (m.direction === "outbound" && m.replyCategory) {
      if (currentRun.length === 0 || currentRun[0].replyCategory === m.replyCategory) {
        currentRun.push(m);
      } else {
        if (currentRun.length >= 3) consecutiveRuns.push([...currentRun]);
        currentRun = [m];
      }
    } else {
      if (currentRun.length >= 3) consecutiveRuns.push([...currentRun]);
      currentRun = [];
    }
  }
  if (currentRun.length >= 3) consecutiveRuns.push([...currentRun]);

  for (const run of consecutiveRuns) {
    findings.push(
      buildFinding({
        code: "conversation_stuck",
        severity: "warning",
        priority: 55,
        summary: `${run.length} consecutive outbound messages with replyCategory="${run[0].replyCategory}" and no inbound between them.`,
        evidence: run.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: [${m.replyCategory}] "${truncate(m.content, 80)}"`,
        ),
        codePath: "ai-reply.ts > handleAiReply()",
      }),
    );
  }

  // Response gap — inbound→outbound gap > 10 min, or no outbound before next inbound
  for (let i = 0; i < normalizedMessages.length; i++) {
    const msg = normalizedMessages[i];
    if (msg.direction !== "inbound") continue;
    const inboundTime = parseDate(msg.createdAt)?.getTime();
    if (!inboundTime) continue;

    const nextOutbound = normalizedMessages.slice(i + 1).find((m) => m.direction === "outbound");
    const nextInbound = normalizedMessages.slice(i + 1).find((m) => m.direction === "inbound");

    if (!nextOutbound) continue; // already caught by other checks
    const outboundTime = parseDate(nextOutbound.createdAt)?.getTime();
    if (!outboundTime) continue;

    const gapMinutes = (outboundTime - inboundTime) / 60000;
    const nextInboundTime = nextInbound ? parseDate(nextInbound.createdAt)?.getTime() : null;
    const nextInboundBeforeReply = nextInboundTime && nextInboundTime < outboundTime;

    if (gapMinutes > 10 || nextInboundBeforeReply) {
      findings.push(
        buildFinding({
          code: "response_gap_detected",
          severity: "warning",
          priority: 60,
          summary: nextInboundBeforeReply
            ? `Lead sent another inbound before bot replied to message at \`${msg.createdAt}\`.`
            : `${Math.round(gapMinutes)} minute response gap after inbound at \`${msg.createdAt}\`.`,
          evidence: [
            `Inbound at \`${msg.createdAt}\`, next outbound at \`${nextOutbound.createdAt}\` (${Math.round(gapMinutes)} min gap).`,
          ],
          codePath: "sms-received.handler.ts",
        }),
      );
      break; // report first gap only
    }
  }

  // After-hours send
  const agentTimezone = agentBundle?.agent?.agent?.timezone ?? null;
  if (agentTimezone) {
    const afterHoursSends = outboundMessages.filter((m) => {
      const hour = parseTimezoneHour(m.createdAt, agentTimezone);
      return hour !== null && (hour >= 21 || hour < 8);
    });
    if (afterHoursSends.length > 0) {
      findings.push(
        buildFinding({
          code: "after_hours_send",
          severity: "info",
          priority: 25,
          summary: `${afterHoursSends.length} outbound message${afterHoursSends.length === 1 ? " was" : "s were"} sent outside 8am-9pm in agent timezone (${agentTimezone}).`,
          evidence: afterHoursSends.slice(0, 3).map(
            (m) => `At \`${m.createdAt}\` (${parseTimezoneHour(m.createdAt, agentTimezone)}:00 local)`,
          ),
          codePath: "Business hours config",
        }),
      );
    }
  }

  return findings;
}

function analyzeGuardrailsAndFallbacks({ outboundMessages }) {
  const findings = [];

  if (outboundMessages.length === 0) return findings;

  // All messages are fallbacks
  const fallbackMessages = outboundMessages.filter((m) => m.fallbackKind != null);
  if (fallbackMessages.length === outboundMessages.length && outboundMessages.length >= 2) {
    findings.push(
      buildFinding({
        code: "all_messages_are_fallbacks",
        severity: "critical",
        priority: 82,
        summary: `Every outbound message (${outboundMessages.length}) used a fallback reply — the AI never generated a primary response.`,
        evidence: [
          `Fallback kinds: ${[...new Set(fallbackMessages.map((m) => m.fallbackKind))].join(", ")}`,
        ],
        codePath: "ai-helpers.ts > buildNonSilentReplyFallback()",
      }),
    );
  }

  // High guardrail violation rate
  const violationMessages = outboundMessages.filter(
    (m) => Array.isArray(m.guardrailViolations) && m.guardrailViolations.length > 0,
  );
  const violationRate = violationMessages.length / outboundMessages.length;
  if (violationRate > 0.5 && violationMessages.length >= 2) {
    findings.push(
      buildFinding({
        code: "high_guardrail_violation_rate",
        severity: "warning",
        priority: 68,
        summary: `${Math.round(violationRate * 100)}% of outbound messages triggered guardrail violations (${violationMessages.length}/${outboundMessages.length}).`,
        evidence: violationMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: violations=[${m.guardrailViolations.join(", ")}]`,
        ),
        codePath: "ai-helpers.ts > enforceReplyGuardrails()",
      }),
    );
  }

  // Frequent violation type
  const violationCounts = {};
  for (const m of outboundMessages) {
    if (!Array.isArray(m.guardrailViolations)) continue;
    for (const v of m.guardrailViolations) {
      violationCounts[v] = (violationCounts[v] || 0) + 1;
    }
  }
  for (const [violation, count] of Object.entries(violationCounts)) {
    if (count >= 3) {
      findings.push(
        buildFinding({
          code: "frequent_violation_type",
          severity: "info",
          priority: 30,
          summary: `Guardrail violation "${violation}" triggered ${count} times.`,
          evidence: [`"${violation}" appeared in ${count} outbound messages' guardrailViolations.`],
          codePath: "ai-helpers.ts > enforceReplyGuardrails()",
        }),
      );
    }
  }

  // False appointment confirmation detected
  const falseConfirmations = outboundMessages.filter(
    (m) => Array.isArray(m.guardrailViolations) && m.guardrailViolations.includes("false_appointment_confirmation"),
  );
  if (falseConfirmations.length > 0) {
    findings.push(
      buildFinding({
        code: "false_appointment_confirmation_detected",
        severity: "critical",
        priority: 80,
        summary: `${falseConfirmations.length} outbound message${falseConfirmations.length === 1 ? "" : "s"} flagged for false appointment confirmation.`,
        evidence: falseConfirmations.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "ai-helpers.ts > containsAppointmentConfirmation()",
      }),
    );
  }

  // Price quote violation detected
  const priceViolations = outboundMessages.filter(
    (m) => Array.isArray(m.guardrailViolations) && m.guardrailViolations.includes("price_quote"),
  );
  if (priceViolations.length > 0) {
    findings.push(
      buildFinding({
        code: "price_quote_violation_detected",
        severity: "critical",
        priority: 85,
        summary: `${priceViolations.length} outbound message${priceViolations.length === 1 ? "" : "s"} flagged for quoting prices.`,
        evidence: priceViolations.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "ai-helpers.ts > containsPriceQuote()",
      }),
    );
  }

  return findings;
}

function analyzeScheduling({ outboundMessages, conversation, agentBundle }) {
  const findings = [];
  const appointments = Array.isArray(agentBundle?.appointments) ? agentBundle.appointments : [];
  const matchingAppointment =
    appointments.find(
      (a) => a.closeLeadId && a.closeLeadId === conversation?.closeLeadId,
    ) ?? appointments[0] ?? null;

  const schedulingOutbound = outboundMessages.filter((m) => m.replyCategory === "scheduling");

  // Scheduling without resolution
  if (
    ["scheduling", "stale"].includes(conversation?.status) &&
    !matchingAppointment &&
    schedulingOutbound.length >= 3
  ) {
    findings.push(
      buildFinding({
        code: "scheduling_without_resolution",
        severity: "warning",
        priority: 56,
        summary: `Conversation status is "${conversation.status}" with ${schedulingOutbound.length} scheduling messages but no appointment created.`,
        evidence: [
          `Status: ${conversation.status}, scheduling outbound: ${schedulingOutbound.length}, appointments: 0.`,
        ],
        codePath: "prepareSchedulingState()",
      }),
    );
  }

  // False booking confirmation — outbound has booking language but no matching appointment
  const bookingConfirmationMessages = outboundMessages.filter(
    (m) => containsBookingConfirmationLanguage(m.content),
  );
  if (bookingConfirmationMessages.length > 0 && !matchingAppointment) {
    findings.push(
      buildFinding({
        code: "false_booking_confirmation",
        severity: "critical",
        priority: 84,
        summary: `Outbound message contains booking confirmation language but no appointment exists.`,
        evidence: bookingConfirmationMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "buildBookedAppointmentReply()",
      }),
    );
  }

  // Multiple scheduling attempts
  if (schedulingOutbound.length >= 5) {
    findings.push(
      buildFinding({
        code: "multiple_scheduling_attempts",
        severity: "info",
        priority: 35,
        summary: `${schedulingOutbound.length} outbound messages with replyCategory="scheduling" — may indicate scheduling difficulty.`,
        evidence: [
          `${schedulingOutbound.length} scheduling outbound messages in this conversation.`,
        ],
        codePath: "Scheduling pipeline",
      }),
    );
  }

  return findings;
}

function analyzeCompliance({ outboundMessages, conversation }) {
  const findings = [];

  // Price language in outbound
  const priceMessages = outboundMessages.filter((m) => containsPriceLanguage(m.content));
  if (priceMessages.length > 0) {
    findings.push(
      buildFinding({
        code: "price_language_in_outbound",
        severity: "critical",
        priority: 87,
        summary: `${priceMessages.length} outbound message${priceMessages.length === 1 ? "" : "s"} contain price/quote language.`,
        evidence: priceMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "enforceReplyGuardrails()",
      }),
    );
  }

  // Life insurance label misuse
  const lifeInsuranceMessages = outboundMessages.filter((m) => containsLifeInsuranceLabel(m.content));
  const mortgageProtectionMessages = outboundMessages.filter(
    (m) => /mortgage protection/i.test(m.content || ""),
  );
  if (lifeInsuranceMessages.length > 0 && mortgageProtectionMessages.length > 0) {
    findings.push(
      buildFinding({
        code: "life_insurance_label_misuse",
        severity: "critical",
        priority: 86,
        summary: `Outbound messages use both "life insurance" and "mortgage protection" — likely wrong label for a mortgage protection lead.`,
        evidence: lifeInsuranceMessages.slice(0, 2).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "getLeadSourceRules()",
      }),
    );
  }

  // DOB request in outbound
  const dobMessages = outboundMessages.filter((m) => containsDobRequest(m.content));
  if (dobMessages.length > 0) {
    findings.push(
      buildFinding({
        code: "dob_request_in_outbound",
        severity: "warning",
        priority: 45,
        summary: `${dobMessages.length} outbound message${dobMessages.length === 1 ? "" : "s"} ask for date of birth or age.`,
        evidence: dobMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: "${truncate(m.content, 100)}"`,
        ),
        codePath: "enforceReplyGuardrails()",
      }),
    );
  }

  // Pushy after decline
  const pushyAfterDecline = conversation?.declineState === "hard" &&
    outboundMessages.some((m) => m.replyCategory === "scheduling");
  if (pushyAfterDecline) {
    const pushyMessages = outboundMessages.filter((m) => m.replyCategory === "scheduling");
    findings.push(
      buildFinding({
        code: "pushy_after_decline",
        severity: "warning",
        priority: 50,
        summary: `Bot sent scheduling messages after lead's hard decline.`,
        evidence: pushyMessages.slice(0, 3).map(
          (m) => `At \`${m.createdAt}\`: [scheduling] "${truncate(m.content, 100)}"`,
        ),
        codePath: "enforceReplyGuardrails()",
      }),
    );
  }

  return findings;
}

// Export analysis passes and utilities for testing
export {
  tokenize,
  jaccardSimilarity,
  isIntroPattern,
  containsPriceLanguage,
  containsLifeInsuranceLabel,
  containsDobRequest,
  containsBookingConfirmationLanguage,
  containsEmojiCharacters,
  isTruncated,
  containsMarkdown,
  parseTimezoneHour,
  analyzeRepetition,
  analyzeMessageQuality,
  analyzeConversationFlow,
  analyzeGuardrailsAndFallbacks,
  analyzeScheduling,
  analyzeCompliance,
};

export function analyzeChatBotLeadReview({
  target,
  agentBundle,
  conversation,
  messages = [],
}) {
  const findings = [];
  const normalizedMessages = sortByCreatedAt(messages);
  const outboundMessages = normalizedMessages.filter(
    (message) => message.direction === "outbound",
  );
  const inboundMessages = normalizedMessages.filter(
    (message) => message.direction === "inbound",
  );
  const senderTypeMismatches = normalizedMessages.filter((message) => {
    if (!message.senderType) return false;
    if (message.direction === "inbound" && message.senderType === "bot")
      return true;
    if (message.direction === "outbound" && message.senderType === "lead")
      return true;
    return false;
  });

  const statusSummary = summarizeAgentStatus(agentBundle);
  const lastInbound = inboundMessages.at(-1) ?? null;
  const lastOutbound = outboundMessages.at(-1) ?? null;
  const lastMessage = normalizedMessages.at(-1) ?? null;
  const appointments = Array.isArray(agentBundle?.appointments)
    ? agentBundle.appointments
    : [];
  const matchingAppointment =
    appointments.find(
      (appointment) =>
        appointment.closeLeadId &&
        appointment.closeLeadId ===
          (target?.leadId ?? conversation?.closeLeadId ?? null),
    ) ?? appointments[0] ?? null;
  const explicitTimezoneAvailabilities =
    extractExplicitTimezoneAvailability(inboundMessages);
  const reminderTimes = extractReminderTimes(normalizedMessages);

  if (!statusSummary.isActive) {
    findings.push(
      buildFinding({
        code: "agent_inactive",
        severity: "critical",
        priority: 100,
        summary: "The bot agent is inactive.",
        evidence: ["`status.isActive` is `false`."],
      }),
    );
  }

  if (!statusSummary.botEnabled) {
    findings.push(
      buildFinding({
        code: "bot_disabled",
        severity: "critical",
        priority: 99,
        summary: "The bot is disabled and will not process new messages.",
        evidence: ["`status.botEnabled` is `false`."],
      }),
    );
  }

  if (!statusSummary.closeConnected) {
    findings.push(
      buildFinding({
        code: "close_disconnected",
        severity: "critical",
        priority: 98,
        summary: "The bot is not connected to Close CRM.",
        evidence: ["`status.closeConnected` is `false`."],
      }),
    );
  }

  if (!statusSummary.calendarConnected) {
    findings.push(
      buildFinding({
        code: "calendar_disconnected",
        severity: "warning",
        priority: 40,
        summary:
          "The bot does not have an active calendar connection for booking.",
        evidence: [
          "`status.calendlyConnected` and `status.googleConnected` are both `false`.",
        ],
      }),
    );
  }

  if (statusSummary.leadLimitReached) {
    findings.push(
      buildFinding({
        code: "lead_limit_reached",
        severity: "critical",
        priority: 97,
        summary: "The bot has reached its monthly lead limit.",
        evidence: [
          `Usage is ${agentBundle.agent.usage.leadCount}/${agentBundle.agent.usage.leadLimit}.`,
        ],
      }),
    );
  }

  if (!conversation) {
    findings.push(
      buildFinding({
        code: "no_conversation_found",
        severity: "critical",
        priority: 96,
        summary:
          "No bot conversation was found for the supplied identifier across the selected agent set.",
        evidence: [
          "The conversation inventory did not contain a matching `closeLeadId`, `conversationId`, or lead search match.",
          "If the lead should have engaged the bot, the next checks are lead source, lead status, valid SMS phone, and whether Close history sync has seen the lead yet.",
        ],
      }),
    );
  } else {
    if (conversation.suppressedAt) {
      findings.push(
        buildFinding({
          code: "conversation_suppressed",
          severity: "critical",
          priority: 95,
          summary: "The conversation was suppressed by the bot platform.",
          evidence: [`\`conversation.suppressedAt\` = \`${conversation.suppressedAt}\`.`],
        }),
      );
    }

    const pausedUntil = parseDate(conversation.botPausedUntil);
    if (pausedUntil && pausedUntil.getTime() > Date.now()) {
      findings.push(
        buildFinding({
          code: "conversation_paused",
          severity: "warning",
          priority: 80,
          summary: "The conversation is currently paused.",
          evidence: [
            `\`conversation.botPausedUntil\` is in the future: \`${conversation.botPausedUntil}\`.`,
          ],
        }),
      );
    }

    if (outboundMessages.length === 0 && inboundMessages.length > 0) {
      findings.push(
        buildFinding({
          code: "no_outbound_response",
          severity: "critical",
          priority: 90,
          summary:
            "The lead sent at least one inbound message, but there is no outbound bot reply in this conversation.",
          evidence: [
            `Inbound count: ${inboundMessages.length}.`,
            "Outbound count: 0.",
          ],
        }),
      );
    }

    if (outboundMessages.length > 0) {
      findings.push(
        buildFinding({
          code: "bot_sent_messages",
          severity: "info",
          priority: 10,
          summary: `The bot sent ${outboundMessages.length} outbound message${outboundMessages.length === 1 ? "" : "s"} in this conversation.`,
          evidence: [
            `First outbound at \`${outboundMessages[0].createdAt}\`.`,
            lastOutbound
              ? `Last outbound at \`${lastOutbound.createdAt}\`.`
              : null,
          ].filter(Boolean),
        }),
      );
    }

    if (
      outboundMessages.length > 0 &&
      inboundMessages.length === 0 &&
      conversation.status === "awaiting_reply"
    ) {
      findings.push(
        buildFinding({
          code: "waiting_for_lead",
          severity: "info",
          priority: 45,
          summary: "The bot has already reached out and is waiting for the lead to reply.",
          evidence: [
            `Conversation status is \`${conversation.status}\`.`,
            lastOutbound
              ? `The last message is outbound at \`${lastOutbound.createdAt}\`.`
              : null,
          ].filter(Boolean),
        }),
      );
    }

    if (lastInbound) {
      const inboundText = (lastInbound.content || "").trim();
      const hasOutboundAfterLastInbound = outboundMessages.some((message) => {
        const messageDate = parseDate(message.createdAt);
        const inboundDate = parseDate(lastInbound.createdAt);
        return (
          messageDate &&
          inboundDate &&
          messageDate.getTime() > inboundDate.getTime()
        );
      });

      if (!hasOutboundAfterLastInbound) {
        if (OPT_OUT_REPLY_PATTERNS.some((pattern) => pattern.test(inboundText))) {
          findings.push(
            buildFinding({
              code: "lead_opt_out_detected",
              severity: "critical",
              priority: 88,
              summary:
                "The last inbound message looks like an SMS opt-out, so the bot should stop replying.",
              evidence: [
                `Last inbound at \`${lastInbound.createdAt}\`: "${truncate(inboundText)}".`,
              ],
            }),
          );
        } else if (
          NEGATIVE_REPLY_PATTERNS.some((pattern) => pattern.test(inboundText))
        ) {
          findings.push(
            buildFinding({
              code: "lead_replied_negative",
              severity: "warning",
              priority: 75,
              summary:
                "The lead's latest reply is a negative response, so the missing follow-up is likely intentional rather than a delivery failure.",
              evidence: [
                `Last inbound at \`${lastInbound.createdAt}\`: "${truncate(inboundText)}".`,
                `Conversation decline state is \`${conversation.declineState ?? "unknown"}\` with objection count ${conversation.objectionCount ?? 0}.`,
              ],
              inference: true,
            }),
          );
        } else {
          findings.push(
            buildFinding({
              code: "lead_replied_without_follow_up",
              severity: "warning",
              priority: 70,
              summary:
                "The lead replied, but there is no later outbound bot message in the current thread.",
              evidence: [
                `Last inbound at \`${lastInbound.createdAt}\`: "${truncate(inboundText)}".`,
                lastOutbound
                  ? `Latest outbound before that was at \`${lastOutbound.createdAt}\`.`
                  : "There are no outbound messages.",
              ],
            }),
          );
        }
      }
    }

    if (
      conversation.status === "awaiting_reply" &&
      lastMessage?.direction === "inbound"
    ) {
      findings.push(
        buildFinding({
          code: "status_mismatch_possible",
          severity: "warning",
          priority: 35,
          summary:
            "The conversation status still says `awaiting_reply`, but the latest message in the thread is inbound.",
          evidence: [
            `Conversation status is \`${conversation.status}\`.`,
            `Latest message is \`${lastMessage.direction}\` at \`${lastMessage.createdAt}\`.`,
          ],
          inference: true,
        }),
      );
    }
  }

  const monitoring = agentBundle?.monitoring ?? null;
  if (monitoring?.jobHealth?.failedJobs24h > 0) {
    findings.push(
      buildFinding({
        code: "job_failures_detected",
        severity: "warning",
        priority: 50,
        summary:
          "The bot platform has recent job failures, which can contribute to missing sends or stale state.",
        evidence: [
          `\`monitoring.jobHealth.failedJobs24h\` = ${monitoring.jobHealth.failedJobs24h}.`,
        ],
      }),
    );
  }

  if (
    conversation &&
    outboundMessages.length === 0 &&
    monitoring?.jobHealth?.pendingJobs > 0
  ) {
    findings.push(
      buildFinding({
        code: "queue_backlog_possible",
        severity: "warning",
        priority: 55,
        summary:
          "The platform queue has pending jobs, so a delayed send is possible.",
        evidence: [
          `\`monitoring.jobHealth.pendingJobs\` = ${monitoring.jobHealth.pendingJobs}.`,
        ],
        inference: true,
      }),
    );
  }

  if (senderTypeMismatches.length > 0) {
    findings.push(
      buildFinding({
        code: "message_metadata_mismatch",
        severity: "warning",
        priority: 32,
        summary:
          "At least one message has inconsistent direction vs sender metadata.",
        evidence: senderTypeMismatches.slice(0, 3).map(
          (message) =>
            `Message at \`${message.createdAt}\` has direction \`${message.direction}\` but senderType \`${message.senderType}\`.`,
        ),
        inference: true,
      }),
    );
  }

  if (
    matchingAppointment &&
    explicitTimezoneAvailabilities.length > 0 &&
    reminderTimes.length > 0
  ) {
    const agentTimeZone = agentBundle?.agent?.agent?.timezone ?? null;
    const explicitAvailability = explicitTimezoneAvailabilities.at(-1);
    const leadTimeZone = explicitAvailability?.timeZone ?? null;
    const reminderTimeTexts = new Set(reminderTimes.map((item) => item.timeText));
    const agentClock = formatClockTime(matchingAppointment.startAt, agentTimeZone);
    const leadClock = formatClockTime(matchingAppointment.startAt, leadTimeZone);

    if (
      explicitAvailability &&
      leadTimeZone &&
      agentClock &&
      leadClock &&
      agentClock !== leadClock &&
      reminderTimeTexts.has(agentClock) &&
      !reminderTimeTexts.has(leadClock) &&
      explicitAvailability.timeText === leadClock
    ) {
      findings.push(
        buildFinding({
          code: "appointment_timezone_mismatch",
          severity: "critical",
          priority: 85,
          summary:
            "Appointment reminders are rendering the appointment in the agent timezone instead of the lead's explicit timezone.",
          evidence: [
            `Lead explicitly provided availability "${truncate(explicitAvailability.content, 120)}" at \`${explicitAvailability.createdAt}\`.`,
            `Appointment \`${matchingAppointment.id}\` starts at \`${matchingAppointment.startAt}\`, which is \`${leadClock}\` in ${leadTimeZone} and \`${agentClock}\` in ${agentTimeZone}.`,
            `Reminder messages used \`${agentClock}\` instead of \`${leadClock}\`.`,
          ],
          codePath: "buildReminderMessage()",
        }),
      );
    }
  }

  // --- Deep analysis passes ---
  // Only analyze bot-sent outbound messages — exclude manually sent human agent messages
  const botOutboundMessages = outboundMessages.filter(
    (message) => message.senderType !== "human",
  );
  const passContext = { normalizedMessages, outboundMessages: botOutboundMessages, inboundMessages, conversation, agentBundle };
  findings.push(
    ...analyzeRepetition(passContext),
    ...analyzeMessageQuality(passContext),
    ...analyzeConversationFlow(passContext),
    ...analyzeGuardrailsAndFallbacks(passContext),
    ...analyzeScheduling(passContext),
    ...analyzeCompliance(passContext),
  );

  const sortedFindings = findings.sort((left, right) => right.priority - left.priority);
  const primaryFinding =
    sortedFindings[0] ??
    buildFinding({
      code: "no_obvious_blocker",
      severity: "info",
      priority: 0,
      summary: "No obvious blocker was detected from the available bot platform data.",
    });

  return {
    target,
    conversation,
    agentSnapshot: agentBundle?.agent?.agent ?? null,
    summary: {
      primaryReasonCode: primaryFinding.code,
      primaryReason: primaryFinding.summary,
      foundConversation: Boolean(conversation),
      outboundCount: outboundMessages.length,
      inboundCount: inboundMessages.length,
      conversationStatus: conversation?.status ?? null,
    },
    findings: sortedFindings,
    timeline: normalizedMessages.map((message) => ({
      createdAt: message.createdAt,
      direction: message.direction,
      senderType: message.senderType ?? null,
      content: message.content ?? "",
      replyCategory: message.replyCategory ?? null,
      fallbackKind: message.fallbackKind ?? null,
      guardrailViolations: message.guardrailViolations ?? null,
      messageKind: message.messageKind ?? null,
    })),
    gaps: [
      "The current bot-platform API does not expose Close lead source/status for an arbitrary lead ID, so source/status mismatch can only be inferred when no conversation exists.",
    ],
  };
}

function formatDiagnosticReview(review) {
  const lines = [];
  lines.push(`Primary finding: ${review.summary.primaryReason}`);
  lines.push(
    `Conversation found: ${review.summary.foundConversation ? "yes" : "no"}`,
  );
  lines.push(
    `Counts: outbound=${review.summary.outboundCount}, inbound=${review.summary.inboundCount}, status=${review.summary.conversationStatus ?? "n/a"}`,
  );
  lines.push("");
  lines.push("Findings:");

  for (const finding of review.findings) {
    const inferenceSuffix = finding.inference ? " (inference)" : "";
    lines.push(
      `- [${finding.severity}] ${finding.code}: ${finding.summary}${inferenceSuffix}`,
    );
    for (const evidence of finding.evidence) {
      lines.push(`  Evidence: ${evidence}`);
    }
  }

  if (review.timeline.length > 0) {
    lines.push("");
    lines.push("Timeline:");
    for (const item of review.timeline) {
      const categoryTag = item.replyCategory ? ` [replyCategory=${item.replyCategory}]` : "";
      lines.push(
        `- ${item.createdAt} | ${item.direction}${categoryTag} | ${truncate(item.content, 220)}`,
      );
      const meta = [];
      if (item.guardrailViolations && item.guardrailViolations.length > 0) {
        meta.push(`guardrails: ${item.guardrailViolations.join(", ")}`);
      }
      if (item.fallbackKind) {
        meta.push(`fallback: ${item.fallbackKind}`);
      }
      if (item.messageKind) {
        meta.push(`kind: ${item.messageKind}`);
      }
      if (meta.length > 0) {
        lines.push(`  ${meta.join(" | ")}`);
      }
    }
  }

  if (review.gaps.length > 0) {
    lines.push("");
    lines.push("Gaps:");
    for (const gap of review.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildChatBotImprovementBrief(review) {
  const lines = [];
  const timeline = review.timeline ?? [];
  const conversation = review.conversation ?? null;
  const agent = review.agentSnapshot ?? null;
  const leadId = review.target?.leadId ?? null;
  const leadName =
    conversation?.leadName ??
    review.target?.leadName ??
    (timeline.length > 0 ? "Unknown lead" : "Unknown lead");
  const latestInbound = [...timeline].reverse().find(
    (message) => message.direction === "inbound",
  );
  const outboundMessages = timeline.filter(
    (message) => message.direction === "outbound",
  );
  const recommendationSet = new Set();
  const testCaseSet = new Set();
  const openQuestionSet = new Set();

  for (const finding of review.findings) {
    switch (finding.code) {
      case "lead_replied_negative":
        recommendationSet.add(
          "Define explicit policy for terse negative replies like `No`: terminal decline, clarification attempt, or deferred follow-up.",
        );
        recommendationSet.add(
          "If clarification is desired, add a single low-pressure follow-up template for ambiguous negative replies such as `No` or `Not now`.",
        );
        testCaseSet.add(
          "Lead replies `No` after intro message: verify whether bot stops, clarifies once, or schedules later based on policy.",
        );
        testCaseSet.add(
          "Lead replies `No thanks` after intro message: verify the bot treats this as a stronger decline than bare `No` if intended.",
        );
        openQuestionSet.add(
          "Should a bare `No` be treated as uninterested, unavailable right now, or ambiguous?",
        );
        break;
      case "lead_opt_out_detected":
        recommendationSet.add(
          "Keep opt-out handling distinct from ordinary negative replies and ensure the conversation moves immediately into a terminal no-contact state.",
        );
        testCaseSet.add(
          "Lead replies `STOP`: verify no further outbound messages are sent and the conversation exits active follow-up flows.",
        );
        break;
      case "status_mismatch_possible":
        recommendationSet.add(
          "Audit state transitions so conversations with latest inbound activity do not remain in `awaiting_reply` unless that status is intentionally overloaded.",
        );
        testCaseSet.add(
          "Inbound reply arrives after outbound intro: verify conversation status updates consistently with the latest event.",
        );
        break;
      case "message_metadata_mismatch":
        recommendationSet.add(
          "Audit message ingestion and serialization so `direction` and `senderType` cannot contradict each other.",
        );
        testCaseSet.add(
          "Inbound SMS ingestion: verify stored message metadata is `direction=inbound` and `senderType=lead`.",
        );
        break;
      case "appointment_timezone_mismatch":
        recommendationSet.add(
          "Render appointment reminder times in the lead timezone when the lead timezone is known; only fall back to agent timezone when lead timezone is unavailable.",
        );
        recommendationSet.add(
          "Include the timezone abbreviation in reminder copy when there is any risk of cross-timezone confusion.",
        );
        testCaseSet.add(
          "Lead confirms `10:00 AM CST`, appointment is stored as `2026-03-18T15:00:00.000Z`, and reminder text must say `10:00 AM`, not `11:00 AM`.",
        );
        testCaseSet.add(
          "Cross-timezone reminder generation should use lead-local appointment time for both 24h and 1h reminders.",
        );
        break;
      case "no_conversation_found":
        recommendationSet.add(
          "Expose Close lead source and lead status in the review path so source/status mismatch can be proven instead of inferred when no conversation exists.",
        );
        recommendationSet.add(
          "Add lead-level diagnostics for valid SMS phone, source match, status match, and suppression before conversation creation.",
        );
        testCaseSet.add(
          "Lead with unmatched source should produce a deterministic `no conversation` reason tied to source mismatch.",
        );
        break;
      case "no_outbound_response":
        recommendationSet.add(
          "Add a deterministic diagnostic for inbound-without-outbound cases so queue delays, disabled bot state, and suppression are easy to separate.",
        );
        testCaseSet.add(
          "Inbound SMS from an allowed lead with healthy dependencies should produce an outbound reply within expected SLA.",
        );
        break;
      case "repeated_outbound_content":
        recommendationSet.add(
          "Add deduplication logic in `enforceReplyGuardrails()` to detect and block outbound messages that are too similar to recent sends.",
        );
        testCaseSet.add(
          "Bot generates reply with >70% Jaccard similarity to previous outbound: verify it is blocked or rewritten.",
        );
        break;
      case "repeated_intro_messages":
        recommendationSet.add(
          "Strengthen `stripRedundantIntro()` to detect and remove intro patterns when the conversation already has an outbound intro.",
        );
        testCaseSet.add(
          "Second outbound starts with 'Hi X, this is...': verify intro is stripped before send.",
        );
        break;
      case "repeated_fallback_reply":
        recommendationSet.add(
          "Vary fallback replies or escalate to manual review after 2+ consecutive fallbacks of the same kind.",
        );
        testCaseSet.add(
          "Same fallbackKind fires 3+ times: verify bot escalates or varies response.",
        );
        break;
      case "repeated_qualification_topic":
        recommendationSet.add(
          "Check `deriveConversationMemory()` — the bot may be losing track of previously asked qualification questions.",
        );
        testCaseSet.add(
          "Bot asks lead's state twice in same conversation: verify memory prevents re-asking.",
        );
        break;
      case "truncated_message":
        recommendationSet.add(
          "Investigate the CRM send path for message truncation — the outbound message ended mid-word.",
        );
        testCaseSet.add(
          "Long outbound message: verify it is delivered complete without truncation.",
        );
        openQuestionSet.add(
          "Is there a character limit on the CRM send path that silently truncates?",
        );
        break;
      case "markdown_in_sms":
        recommendationSet.add(
          "Ensure `sanitizeSmsReply()` strips all markdown formatting (**, ##, list markers) before sending.",
        );
        testCaseSet.add(
          "AI reply contains `**bold**` or `## heading`: verify sanitizer removes formatting before SMS send.",
        );
        break;
      case "wall_of_text":
        recommendationSet.add(
          "Add a character limit guard in prompt construction or post-processing to keep SMS under 320 chars.",
        );
        testCaseSet.add(
          "AI generates 400+ char reply: verify it is shortened or split before send.",
        );
        break;
      case "emoji_in_outbound":
        recommendationSet.add(
          "Verify `sanitizeSmsReply()` strips emoji characters — the bot rules prohibit emoji in SMS.",
        );
        testCaseSet.add(
          "AI reply contains emoji: verify sanitizer removes them before send.",
        );
        break;
      case "outbound_spam_ratio":
        recommendationSet.add(
          "Review intro and follow-up handlers — the bot sent 5x more messages than the lead, indicating possible over-messaging.",
        );
        testCaseSet.add(
          "Bot sends 5+ outbound with only 1 inbound: verify rate limiting or conversation pausing kicks in.",
        );
        openQuestionSet.add(
          "Should the bot cap outbound messages before a lead reply to prevent spam perception?",
        );
        break;
      case "conversation_stuck":
        recommendationSet.add(
          "Detect consecutive outbound with same replyCategory and either vary the approach or pause the conversation.",
        );
        testCaseSet.add(
          "3+ outbound with same replyCategory and no inbound: verify bot changes strategy or stops.",
        );
        break;
      case "response_gap_detected":
        recommendationSet.add(
          "Investigate response latency in `sms-received.handler.ts` — lead waited 10+ minutes for a reply.",
        );
        testCaseSet.add(
          "Inbound message arrives: verify outbound reply within SLA (e.g. 2 minutes).",
        );
        break;
      case "after_hours_send":
        recommendationSet.add(
          "Verify business hours configuration — outbound messages were sent outside 8am-9pm in the agent timezone.",
        );
        testCaseSet.add(
          "Outbound scheduled at 10pm agent time: verify it is deferred to next morning.",
        );
        break;
      case "all_messages_are_fallbacks":
        recommendationSet.add(
          "Every outbound used a fallback — the AI primary response path is failing. Check `buildNonSilentReplyFallback()` triggers and AI provider health.",
        );
        testCaseSet.add(
          "AI provider returns error: verify fallback fires once, then escalates rather than repeating fallback.",
        );
        openQuestionSet.add(
          "Is the AI provider consistently failing, or is the prompt causing guardrail rejections?",
        );
        break;
      case "high_guardrail_violation_rate":
        recommendationSet.add(
          "Over 50% of outbound triggered guardrails — review `enforceReplyGuardrails()` thresholds or prompt wording.",
        );
        testCaseSet.add(
          "Standard conversation flow: verify guardrail violation rate stays below 50%.",
        );
        break;
      case "frequent_violation_type":
        recommendationSet.add(
          "A specific guardrail violation is firing repeatedly — may indicate a prompt issue or overly aggressive guardrail.",
        );
        testCaseSet.add(
          "Replay conversation: verify the specific violation type is addressed by prompt or guardrail tuning.",
        );
        break;
      case "false_appointment_confirmation_detected":
        recommendationSet.add(
          "Bot sent appointment confirmation language without a real booking — check `containsAppointmentConfirmation()` detection.",
        );
        testCaseSet.add(
          "AI reply says 'you\\'re all set' with no appointment: verify guardrail catches and blocks it.",
        );
        break;
      case "price_quote_violation_detected":
        recommendationSet.add(
          "Bot quoted prices despite guardrail — strengthen `containsPriceQuote()` detection or prompt instructions.",
        );
        testCaseSet.add(
          "AI reply contains dollar amounts: verify guardrail blocks before send.",
        );
        break;
      case "scheduling_without_resolution":
        recommendationSet.add(
          "Multiple scheduling messages sent but no appointment created — check `prepareSchedulingState()` and calendar availability.",
        );
        testCaseSet.add(
          "3+ scheduling outbound with no appointment: verify bot either books or explains the blocker.",
        );
        break;
      case "false_booking_confirmation":
        recommendationSet.add(
          "Bot said the appointment was booked but no appointment exists — check `buildBookedAppointmentReply()` trigger conditions.",
        );
        testCaseSet.add(
          "Outbound says 'booked' or 'confirmed': verify a matching appointment record exists.",
        );
        break;
      case "multiple_scheduling_attempts":
        recommendationSet.add(
          "Many scheduling attempts may indicate calendar availability issues or lead confusion — review the scheduling pipeline.",
        );
        testCaseSet.add(
          "5+ scheduling outbound: verify bot is not looping on unavailable slots.",
        );
        break;
      case "price_language_in_outbound":
        recommendationSet.add(
          "CRITICAL: Bot sent price/quote language over SMS — this violates compliance rules. Strengthen `enforceReplyGuardrails()` price detection.",
        );
        testCaseSet.add(
          "AI reply mentions '$', 'premium', 'rate', 'cost': verify guardrail blocks before send.",
        );
        break;
      case "life_insurance_label_misuse":
        recommendationSet.add(
          "Bot used 'life insurance' for a mortgage protection lead — check `getLeadSourceRules()` and prompt injection of source rules.",
        );
        testCaseSet.add(
          "Mortgage protection lead conversation: verify no outbound contains 'life insurance'.",
        );
        break;
      case "dob_request_in_outbound":
        recommendationSet.add(
          "Bot asked for date of birth or age — this should not be requested over SMS. Check guardrail detection.",
        );
        testCaseSet.add(
          "AI reply asks for DOB or age: verify guardrail catches and removes the request.",
        );
        break;
      case "pushy_after_decline":
        recommendationSet.add(
          "Bot continued scheduling push after lead's hard decline — check `enforceReplyGuardrails()` decline state handling.",
        );
        testCaseSet.add(
          "Lead hard-declines: verify no further scheduling outbound messages are sent.",
        );
        break;
      default:
        break;
    }
  }

  if (recommendationSet.size === 0) {
    recommendationSet.add(
      "Review the system prompt and conversation policy for this case; the diagnostic data does not yet identify a clear conversational improvement.",
    );
  }

  if (testCaseSet.size === 0) {
    testCaseSet.add(
      "Replay this exact timeline in a regression test once the desired behavior is defined.",
    );
  }

  lines.push("Case Summary");
  lines.push(
    `- Lead: ${leadName}${leadId ? ` (${leadId})` : ""}`,
  );
  lines.push(
    `- Primary issue: ${review.summary.primaryReasonCode} (${titleCaseFromCode(review.summary.primaryReasonCode)})`,
  );
  lines.push(
    `- Current conversation status: ${review.summary.conversationStatus ?? "unknown"}`,
  );
  if (agent?.name) {
    lines.push(`- Agent: ${agent.name}`);
  }

  lines.push("");
  lines.push("Observed Behavior");
  for (const item of outboundMessages.slice(0, 3)) {
    lines.push(
      `- Bot message at ${item.createdAt}: "${truncate(item.content, 220)}"`,
    );
  }
  if (latestInbound) {
    lines.push(
      `- Lead reply at ${latestInbound.createdAt}: "${truncate(latestInbound.content, 220)}"`,
    );
  }
  for (const finding of review.findings.filter(
    (item) =>
      item.code !== "bot_sent_messages" && item.code !== "lead_replied_negative",
  )) {
    lines.push(
      `- Additional signal: ${finding.summary}${finding.inference ? " (inference)" : ""}`,
    );
  }

  lines.push("");
  lines.push("Desired Behavior Questions");
  for (const question of openQuestionSet) {
    lines.push(`- ${question}`);
  }

  lines.push("");
  lines.push("Recommended Changes");
  for (const recommendation of recommendationSet) {
    lines.push(`- ${recommendation}`);
  }

  lines.push("");
  lines.push("Regression Tests");
  for (const testCase of testCaseSet) {
    lines.push(`- ${testCase}`);
  }

  lines.push("");
  lines.push("Evidence Snapshot");
  for (const finding of review.findings.slice(0, 5)) {
    const inferenceSuffix = finding.inference ? " (inference)" : "";
    lines.push(`- ${finding.code}: ${finding.summary}${inferenceSuffix}`);
  }

  if (review.gaps.length > 0) {
    lines.push("");
    lines.push("Gaps");
    for (const gap of review.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  // Code Paths to Investigate — deduped, grouped by file
  const codePathFindings = review.findings.filter((f) => f.codePath);
  if (codePathFindings.length > 0) {
    const pathsByFile = {};
    for (const f of codePathFindings) {
      const parts = f.codePath.split(" > ");
      const file = parts[0] || f.codePath;
      if (!pathsByFile[file]) pathsByFile[file] = new Set();
      pathsByFile[file].add(f.codePath);
    }
    lines.push("");
    lines.push("Code Paths to Investigate");
    for (const paths of Object.values(pathsByFile)) {
      for (const path of paths) {
        lines.push(`- ${path}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatChatBotLeadReview(
  review,
  { asJson = false, mode = "diagnostic" } = {},
) {
  if (asJson) {
    const payload =
      mode === "improve"
        ? {
            review,
            improvementBrief: buildChatBotImprovementBrief(review),
          }
        : review;
    return JSON.stringify(payload, null, 2);
  }

  if (mode === "improve") {
    return buildChatBotImprovementBrief(review);
  }

  return formatDiagnosticReview(review);
}
