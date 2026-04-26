// /home/nneessen/projects/commissionTracker/src/features/auth/DeniedAccess.tsx

import React from "react";
import { Button } from "../../components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "../../services/base/supabase";
import { useNavigate } from "@tanstack/react-router";

export const DeniedAccess: React.FC<{ email?: string; reason?: string }> = ({
  email,
  reason,
}) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="theme-v2 v2-canvas font-display text-v2-ink min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
            CT
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-muted-foreground">
            Your account application was not approved
          </p>
        </div>

        <Card className="shadow-xl border-destructive/30">
          <CardContent className="p-8 space-y-6">
            <div className="flex justify-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 text-destructive">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
            </div>

            <div className="text-center space-y-3">
              <p className="text-base text-foreground font-medium">
                Account application denied
              </p>
              {email && (
                <p className="text-sm text-muted-foreground">
                  Account:{" "}
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Unfortunately, your account application has been denied by an
                administrator and you will not be able to access the
                application.
              </p>
            </div>

            {reason && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-muted-foreground">
                      Reason
                    </span>
                  </div>
                </div>

                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-foreground text-center">
                    {reason}
                  </p>
                </div>
              </>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-muted-foreground">
                  Need help?
                </span>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground space-y-2">
              <p>
                If you believe this is a mistake or would like to appeal this
                decision, please contact the administrator.
              </p>
              <p className="font-semibold text-foreground">
                Contact: nickneessen@thestandardhq.com
              </p>
            </div>

            <Button
              type="button"
              onClick={handleSignOut}
              variant="outline"
              className="w-full text-center text-sm font-medium py-3 rounded-xl"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Questions? Contact support at nickneessen@thestandardhq.com
        </p>
      </div>
    </div>
  );
};
