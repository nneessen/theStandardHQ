import { useMemo } from "react";
import { useCurrentUserProfile, useAuthorizationStatus } from "@/hooks/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";

export function AuthDiagnostic() {
  const { supabaseUser, session, error: authError } = useAuth();
  const {
    data: profile,
    error: profileError,
    isLoading: profileLoading,
  } = useCurrentUserProfile();
  const authStatus = useAuthorizationStatus();

  const sessionData = useMemo(() => {
    if (!session) return null;
    return {
      expires_at: session.expires_at,
      refresh_token: session.refresh_token ? "Present" : "Missing",
      user_email: session.user?.email,
      user_id: session.user?.id,
    };
  }, [session]);

  const statusIcon = authStatus.isApproved ? (
    <CheckCircle className="h-5 w-5 text-success" />
  ) : authStatus.isPending ? (
    <AlertCircle className="h-5 w-5 text-warning" />
  ) : (
    <XCircle className="h-5 w-5 text-destructive" />
  );

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Auth Diagnostic Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Auth User Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Auth User
              {supabaseUser && <CheckCircle className="h-4 w-4 text-success" />}
              {authError && <XCircle className="h-4 w-4 text-destructive" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supabaseUser ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>ID:</strong> {supabaseUser.id}
                </p>
                <p>
                  <strong>Email:</strong> {supabaseUser.email}
                </p>
                <p>
                  <strong>Role:</strong> {supabaseUser.role || "N/A"}
                </p>
                <p>
                  <strong>Created:</strong>{" "}
                  {new Date(supabaseUser.created_at).toLocaleString()}
                </p>
                <details>
                  <summary className="cursor-pointer text-muted-foreground">
                    View Metadata
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(
                      {
                        app: supabaseUser.app_metadata,
                        user: supabaseUser.user_metadata,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ) : authError ? (
              <p className="text-destructive">Error: {authError.message}</p>
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Session Card */}
        <Card>
          <CardHeader>
            <CardTitle>Session Info</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionData ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>User ID:</strong> {sessionData.user_id}
                </p>
                <p>
                  <strong>Email:</strong> {sessionData.user_email}
                </p>
                <p>
                  <strong>Expires:</strong>{" "}
                  {sessionData.expires_at
                    ? new Date(sessionData.expires_at * 1000).toLocaleString()
                    : "N/A"}
                </p>
                <p>
                  <strong>Refresh Token:</strong> {sessionData.refresh_token}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No session data</p>
            )}
          </CardContent>
        </Card>

        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              User Profile
              {profile && <CheckCircle className="h-4 w-4 text-success" />}
              {profileError && <XCircle className="h-4 w-4 text-destructive" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : profile ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>ID:</strong> {profile.id}
                </p>
                <p>
                  <strong>Email:</strong> {profile.email}
                </p>
                <p>
                  <strong>Status:</strong>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs ${
                      profile.approval_status === "approved"
                        ? "bg-success/20 text-success"
                        : profile.approval_status === "pending"
                          ? "bg-warning/20 text-warning"
                          : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {profile.approval_status}
                  </span>
                </p>
                <p>
                  <strong>Is Admin:</strong>
                  <span
                    className={`ml-2 ${profile.is_admin ? "text-success" : "text-muted-foreground"}`}
                  >
                    {profile.is_admin ? "Yes" : "No"}
                  </span>
                </p>
                {profile.approved_at && (
                  <p>
                    <strong>Approved:</strong>{" "}
                    {new Date(profile.approved_at).toLocaleString()}
                  </p>
                )}
                {profile.denial_reason && (
                  <p className="text-destructive">
                    <strong>Denial Reason:</strong> {profile.denial_reason}
                  </p>
                )}
              </div>
            ) : profileError ? (
              <p className="text-destructive">Error: {profileError.message}</p>
            ) : (
              <p className="text-muted-foreground">No profile found</p>
            )}
          </CardContent>
        </Card>

        {/* Authorization Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Authorization Status
              {statusIcon}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <strong>Is Admin:</strong>
                {authStatus.isAdmin ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {authStatus.isAdmin ? "Yes" : "No"}
              </p>
              <p className="flex items-center gap-2">
                <strong>Is Approved:</strong>
                {authStatus.isApproved ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {authStatus.isApproved ? "Yes" : "No"}
              </p>
              <p className="flex items-center gap-2">
                <strong>Is Pending:</strong>
                {authStatus.isPending ? "Yes" : "No"}
              </p>
              <p className="flex items-center gap-2">
                <strong>Is Denied:</strong>
                {authStatus.isDenied ? "Yes" : "No"}
              </p>
              {authStatus.denialReason && (
                <p>
                  <strong>Denial Reason:</strong> {authStatus.denialReason}
                </p>
              )}
              <p>
                <strong>Is Loading:</strong>{" "}
                {authStatus.isLoading ? "Yes" : "No"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostic Checks */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Diagnostic Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {supabaseUser?.id === profile?.id ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span>Auth User ID matches Profile ID</span>
              {supabaseUser?.id !== profile?.id && (
                <span className="text-destructive text-sm ml-2">
                  (Auth: {supabaseUser?.id}, Profile: {profile?.id})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {supabaseUser?.email === profile?.email ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span>Auth Email matches Profile Email</span>
              {supabaseUser?.email !== profile?.email && (
                <span className="text-destructive text-sm ml-2">
                  (Auth: {supabaseUser?.email}, Profile: {profile?.email})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {profile?.approval_status === "approved" || profile?.is_admin ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span>User should have access (approved or admin)</span>
            </div>

            <div className="flex items-center gap-2">
              {authStatus.isApproved ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span>Authorization hook returns approved</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
              variant="destructive"
            >
              Clear Storage & Reload
            </Button>

            <Button
              onClick={async () => {
                const { error } = await supabase.auth.refreshSession();
                if (error) {
                  alert("Failed to refresh session: " + error.message);
                } else {
                  window.location.reload();
                }
              }}
              variant="secondary"
            >
              Refresh Session
            </Button>

            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              variant="outline"
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
