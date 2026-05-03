// src/features/chat-bot/components/AgentProfileSection.tsx
// Agent profile settings for personalizing chatbot identity and conversation style

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, Loader2, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { US_STATES } from "@/constants/states";
import { useChatBotAgent, useUpdateBotConfig } from "../hooks/useChatBot";

type BotConfigPayload = Parameters<
  ReturnType<typeof useUpdateBotConfig>["mutate"]
>[0];

const NONE_VALUE = "__none__";

export function AgentProfileSection() {
  const { data: agent } = useChatBotAgent();
  const updateConfig = useUpdateBotConfig();

  // Local state for all profile fields
  const [agentName, setAgentName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [residentState, setResidentState] = useState("");
  const [nonResidentStates, setNonResidentStates] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");

  // Input buffers for add-on-enter fields
  const [specialtyInput, setSpecialtyInput] = useState("");

  // Initialize local state from agent data
  useEffect(() => {
    if (!agent) return;
    setAgentName(agent.name ?? "");
    setCompanyName(agent.companyName ?? "");
    setJobTitle(agent.jobTitle ?? "");
    setBio(agent.bio ?? "");
    setYearsOfExperience(
      agent.yearsOfExperience != null ? String(agent.yearsOfExperience) : "",
    );
    setResidentState(agent.residentState ?? "");
    setNonResidentStates(agent.nonResidentStates ?? []);
    setSpecialties(agent.specialties ?? []);
    setWebsite(agent.website ?? "");
    setLocation(agent.location ?? "");
  }, [agent]);

  // Single source of truth for changed fields — used by both isDirty and handleSave
  const getChangedFields = useCallback((): BotConfigPayload => {
    if (!agent) return {};
    const changes: BotConfigPayload = {};
    if (agentName !== (agent.name ?? "")) changes.name = agentName || undefined;
    if (companyName !== (agent.companyName ?? ""))
      changes.companyName = companyName || null;
    if (jobTitle !== (agent.jobTitle ?? ""))
      changes.jobTitle = jobTitle || null;
    if (bio !== (agent.bio ?? "")) changes.bio = bio || null;
    if (
      yearsOfExperience !==
      (agent.yearsOfExperience != null ? String(agent.yearsOfExperience) : "")
    )
      changes.yearsOfExperience = yearsOfExperience
        ? parseInt(yearsOfExperience, 10)
        : null;
    if (residentState !== (agent.residentState ?? ""))
      changes.residentState = residentState || null;
    if (
      JSON.stringify(nonResidentStates) !==
      JSON.stringify(agent.nonResidentStates ?? [])
    )
      changes.nonResidentStates = nonResidentStates.length
        ? nonResidentStates
        : null;
    if (JSON.stringify(specialties) !== JSON.stringify(agent.specialties ?? []))
      changes.specialties = specialties.length ? specialties : null;
    if (website !== (agent.website ?? "")) changes.website = website || null;
    if (location !== (agent.location ?? ""))
      changes.location = location || null;
    return changes;
  }, [
    agent,
    agentName,
    companyName,
    jobTitle,
    bio,
    yearsOfExperience,
    residentState,
    nonResidentStates,
    specialties,
    website,
    location,
  ]);

  const isDirty = useMemo(
    () => Object.keys(getChangedFields()).length > 0,
    [getChangedFields],
  );

  // Filter non-resident states to exclude resident state
  const availableNonResidentStates = US_STATES.filter(
    (s) => s.value !== residentState,
  );

  const handleSave = () => {
    // Validate website URL format if provided
    if (website && !/^https?:\/\/.+/.test(website)) {
      toast.error("Website must start with http:// or https://");
      return;
    }
    updateConfig.mutate(getChangedFields());
  };

  const addSpecialty = () => {
    const trimmed = specialtyInput.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties([...specialties, trimmed]);
      setSpecialtyInput("");
    }
  };

  const removeSpecialty = (s: string) => {
    setSpecialties(specialties.filter((x) => x !== s));
  };

  const addNonResidentState = (val: string) => {
    if (val === NONE_VALUE) return;
    if (!nonResidentStates.includes(val)) {
      setNonResidentStates([...nonResidentStates, val]);
    }
  };

  const removeNonResidentState = (val: string) => {
    setNonResidentStates(nonResidentStates.filter((s) => s !== val));
  };

  return (
    <div className="p-3 border border-border dark:border-border bg-card rounded-lg">
      <div className="flex items-center gap-1.5 mb-2">
        <User className="h-3 w-3 text-muted-foreground" />
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
          Agent Profile
        </h2>
      </div>
      <p className="text-[10px] text-muted-foreground dark:text-muted-foreground mb-3">
        Personalize your bot&apos;s identity and conversation style. These
        details help the bot introduce itself and tailor responses.
      </p>

      <div className="space-y-2.5">
        {/* Agent Name (full-width) */}
        <div>
          <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
            Agent Name
          </label>
          <Input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value.slice(0, 255))}
            placeholder="e.g. John Smith"
            className="h-7 text-[11px]"
            disabled={updateConfig.isPending}
          />
          <p className="text-[9px] text-muted-foreground mt-0.5">
            The name the bot introduces itself as when texting leads.
          </p>
        </div>

        {/* Row 1: Company Name + Job Title */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
              Company Name
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value.slice(0, 255))}
              placeholder="e.g. Acme Insurance"
              className="h-7 text-[11px]"
              disabled={updateConfig.isPending}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
              Job Title
            </label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value.slice(0, 255))}
              placeholder="e.g. Licensed Insurance Agent"
              className="h-7 text-[11px]"
              disabled={updateConfig.isPending}
            />
          </div>
        </div>

        {/* Bio (full-width) */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground">
              Bio
            </label>
            <span className="text-[9px] text-muted-foreground">
              {bio.length}/1000
            </span>
          </div>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 1000))}
            placeholder="Brief description of your background and approach..."
            className="text-[11px] min-h-[60px] resize-none"
            rows={3}
            disabled={updateConfig.isPending}
          />
        </div>

        {/* Row 2: Resident State + Years of Experience */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
              Resident State
            </label>
            <Select
              value={residentState || NONE_VALUE}
              onValueChange={(val) =>
                setResidentState(val === NONE_VALUE ? "" : val)
              }
              disabled={updateConfig.isPending}
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE} className="text-[11px]">
                  None
                </SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem
                    key={s.value}
                    value={s.value}
                    className="text-[11px]"
                  >
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
              Years of Experience
            </label>
            <Input
              type="number"
              value={yearsOfExperience}
              onChange={(e) => {
                const val = e.target.value;
                if (
                  val === "" ||
                  (/^\d+$/.test(val) && Number(val) >= 0 && Number(val) <= 100)
                ) {
                  setYearsOfExperience(val);
                }
              }}
              placeholder="e.g. 10"
              className="h-7 text-[11px]"
              min={0}
              max={100}
              disabled={updateConfig.isPending}
            />
          </div>
        </div>

        {/* Non-Resident States (full-width) */}
        <div>
          <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
            Non-Resident States
          </label>
          {nonResidentStates.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {nonResidentStates.map((val) => {
                const st = US_STATES.find((s) => s.value === val);
                return (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="text-[9px] h-5 px-1.5 gap-0.5"
                  >
                    {st?.label ?? val}
                    <button
                      type="button"
                      onClick={() => removeNonResidentState(val)}
                      className="ml-0.5 hover:text-destructive"
                      disabled={updateConfig.isPending}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <Select
            value={NONE_VALUE}
            onValueChange={addNonResidentState}
            disabled={updateConfig.isPending}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="Add state..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE} className="text-[11px]">
                Add state...
              </SelectItem>
              {availableNonResidentStates
                .filter((s) => !nonResidentStates.includes(s.value))
                .map((s) => (
                  <SelectItem
                    key={s.value}
                    value={s.value}
                    className="text-[11px]"
                  >
                    {s.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Specialties (full-width) */}
        <div>
          <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
            Specialties
          </label>
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {specialties.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="text-[9px] h-5 px-1.5 gap-0.5"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    className="ml-0.5 hover:text-destructive"
                    disabled={updateConfig.isPending}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <Input
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="Type specialty and press Enter"
              className="h-7 text-[11px] flex-1"
              disabled={updateConfig.isPending}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px]"
              onClick={addSpecialty}
              disabled={updateConfig.isPending || !specialtyInput.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Row 3: Website + Location */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
              Website
            </label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value.slice(0, 500))}
              placeholder="https://example.com"
              className="h-7 text-[11px]"
              disabled={updateConfig.isPending}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground dark:text-muted-foreground mb-0.5 block">
              Location
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value.slice(0, 255))}
              placeholder="e.g. Dallas, TX"
              className="h-7 text-[11px]"
              disabled={updateConfig.isPending}
            />
          </div>
        </div>

        {/* Save button */}
        {isDirty && (
          <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border dark:border-border">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={updateConfig.isPending}
              onClick={handleSave}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
