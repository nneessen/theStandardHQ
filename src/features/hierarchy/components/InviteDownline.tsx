// src/features/hierarchy/components/InviteDownline.tsx

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Mail, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateAgentHierarchy } from "@/hooks";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";

export function InviteDownline() {
  const { user } = useAuth();
  const updateHierarchy = useUpdateAgentHierarchy();

  const [downlineEmail, setDownlineEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate referral link with user's email as query param
  const referralLink = user?.email
    ? `${window.location.origin}/signup?upline=${encodeURIComponent(user.email)}`
    : "";

  const handleCopyReferralLink = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleAddDownline = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!user?.id || !downlineEmail.trim()) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      // Find user by email using secure RPC function
      const { data, error: lookupError } = await supabase.rpc(
        "lookupuser_by_email",
        { p_email: downlineEmail.trim() },
      );

      if (lookupError) {
        setError("Failed to lookup user. Please try again.");
        console.error("Lookup error:", lookupError);
        return;
      }

      const downline = data?.[0]; // RPC returns array

      if (!downline) {
        setError("No user found with that email. They need to sign up first.");
        return;
      }

      if (downline.id === user.id) {
        setError("You cannot add yourself as a downline");
        return;
      }

      if (downline.upline_id) {
        setError(
          `${downline.email} already has an upline. They need to remove it first.`,
        );
        return;
      }

      // Assign this user as the upline
      await updateHierarchy.mutateAsync({
        agent_id: downline.id,
        new_upline_id: user.id,
      });

      setSuccess(true);
      setDownlineEmail("");
      setTimeout(() => setSuccess(false), 3000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (err: any) {
      setError(err.message || "Failed to add downline");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Share Your Referral Link
          </CardTitle>
          <CardDescription>
            Send this link to potential team members. When they sign up, you'll
            be set as their upline automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="referral-link">Your Referral Link</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="referral-link"
                value={referralLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                onClick={handleCopyReferralLink}
                variant="outline"
                size="icon"
                className="shrink-0"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {copied && (
              <p className="text-sm text-success mt-2">Copied to clipboard!</p>
            )}
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> Send this link via email, text, or social
              media. When someone signs up using this link, they'll
              automatically be added to your team.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Add */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Existing User
          </CardTitle>
          <CardDescription>
            If someone already has an account, you can add them to your team by
            email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDownline} className="space-y-4">
            <div>
              <Label htmlFor="downline-email">Team Member Email</Label>
              <Input
                id="downline-email"
                type="email"
                value={downlineEmail}
                onChange={(e) => setDownlineEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="mt-2"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Downline added successfully!
              </div>
            )}

            <Button
              type="submit"
              disabled={updateHierarchy.isPending || !downlineEmail.trim()}
              className="w-full"
            >
              {updateHierarchy.isPending ? "Adding..." : "Add to My Team"}
            </Button>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                ℹ️ <strong>Note:</strong> The user must not already have an
                upline. If they do, they'll need to remove their current upline
                in Settings first.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
