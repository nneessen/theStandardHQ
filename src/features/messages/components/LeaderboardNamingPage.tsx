// src/features/messages/components/slack/LeaderboardNamingPage.tsx
// Page for the first seller of the day to name the daily leaderboard

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

interface DailyLog {
  id: string;
  imo_id: string;
  slack_integration_id: string | null;
  channel_id: string;
  log_date: string;
  title: string | null;
  first_seller_id: string;
  is_first_seller: boolean;
  can_rename: boolean;
  leaderboard_message_ts: string | null;
  title_set_at: string | null;
}

interface LeaderboardNamingPageProps {
  logId?: string;
}

const SUGGESTED_NAMES = [
  "Freaky Friday Sales",
  "Money Monday Madness",
  "Terrific Tuesday",
  "Winner Wednesday",
  "Thrilling Thursday",
  "Super Saturday Sales",
  "Sunday Funday Sales",
  "The Grind Continues",
  "Champions Club",
  "Sales Surge",
  "Top Producers",
  "Elite Performance",
];

export function LeaderboardNamingPage({ logId }: LeaderboardNamingPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get log ID from URL if not passed as prop
  const urlParams = new URLSearchParams(window.location.search);
  const effectiveLogId = logId || urlParams.get("logId");

  // Fetch today's logs for the user
  const { data: dailyLogs, isLoading } = useQuery({
    queryKey: ["daily-sales-logs", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_daily_sales_logs");
      if (error) throw error;
      return data as DailyLog[];
    },
    enabled: !!user,
  });

  // Find the specific log if logId is provided, otherwise find one they can rename
  const targetLog = dailyLogs?.find((log) =>
    effectiveLogId ? log.id === effectiveLogId : log.can_rename,
  );

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async ({ logId, title }: { logId: string; title: string }) => {
      const { data, error } = await supabase.rpc(
        "update_daily_leaderboard_title",
        {
          p_log_id: logId,
          p_title: title,
          p_user_id: user?.id,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["daily-sales-logs"] });

      // Trigger refresh of the leaderboard message in Slack
      if (targetLog) {
        try {
          await supabase.functions.invoke("slack-refresh-leaderboard", {
            body: {
              logId: targetLog.id,
              title: title,
            },
          });
        } catch (err) {
          console.error("Failed to refresh leaderboard:", err);
        }
      }

      // Redirect after a short delay
      setTimeout(() => {
        navigate({ to: "/" });
      }, 2000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLog || !title.trim()) return;

    setError(null);
    updateTitleMutation.mutate({ logId: targetLog.id, title: title.trim() });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setTitle(suggestion);
  };

  // Get day name for display
  const getDayName = () => {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Not Authenticated
            </CardTitle>
            <CardDescription>
              Please log in to name the leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: "/login" })}
              className="w-full"
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              Leaderboard Named!
            </CardTitle>
            <CardDescription>
              Today's leaderboard is now "{title}". Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!targetLog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              No Leaderboard to Name
            </CardTitle>
            <CardDescription>
              {dailyLogs?.length === 0
                ? "No sales have been posted today yet. Be the first to make a sale!"
                : dailyLogs?.some((log) => log.title_set_at)
                  ? "Today's leaderboard has already been named."
                  : "You're not the first seller today, so you can't name the leaderboard."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/" })}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
            <Trophy className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Sparkles className="h-5 w-5 text-warning" />
            Congrats, First Sale!
            <Sparkles className="h-5 w-5 text-warning" />
          </CardTitle>
          <CardDescription className="text-base">
            You made the first sale of {getDayName()}! Give today's leaderboard
            a creative name.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Leaderboard Name</Label>
              <Input
                id="title"
                placeholder="e.g., Freaky Friday Sales"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                required
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">Max 50 characters</p>
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Or pick a suggestion:
              </Label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_NAMES.slice(0, 6).map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/" })}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || updateTitleMutation.isPending}
                className="flex-1"
              >
                {updateTitleMutation.isPending ? "Saving..." : "Name It!"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default LeaderboardNamingPage;
