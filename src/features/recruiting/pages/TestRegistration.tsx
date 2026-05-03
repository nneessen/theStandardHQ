// Minimal test component to debug registration verification
import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";

export function TestRegistration() {
  const params = useParams({ strict: false }) as { token?: string };
  const token = params.token;

  const [status, setStatus] = useState("initializing");
  const [result, setResult] = useState<object | null>(null);
  const [error, setError] = useState<object | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    async function test() {
      setStatus("calling-rpc");
      console.log("[TestRegistration] Calling RPC with token:", token);

      try {
        const startTime = Date.now();
        const { data, error } = await supabase.rpc(
          "get_public_invitation_by_token",
          { p_token: token },
        );
        const elapsed = Date.now() - startTime;

        console.log("[TestRegistration] RPC completed in", elapsed, "ms");
        console.log("[TestRegistration] Data:", data);
        console.log("[TestRegistration] Error:", error);

        if (error) {
          setError(error as object);
          setStatus("rpc-error");
        } else {
          setResult(data as object);
          setStatus("success");
        }
      } catch (err) {
        console.error("[TestRegistration] Exception:", err);
        setError({ message: String(err) });
        setStatus("exception");
      }
    }

    test();
  }, [token]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Registration Debug</h1>

      <div className="space-y-4">
        <div>
          <strong>Token:</strong> {token || "(none)"}
        </div>

        <div>
          <strong>Status:</strong> {status}
        </div>

        {error && (
          <div className="p-4 bg-destructive/20 rounded">
            <strong>Error:</strong>
            <pre className="text-sm mt-2">
              {JSON.stringify(error as object, null, 2)}
            </pre>
          </div>
        )}

        {result && (
          <div className="p-4 bg-success/20 rounded">
            <strong>Result:</strong>
            <pre className="text-sm mt-2">
              {JSON.stringify(result as object, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-sm text-muted-foreground mt-8">
          Check browser console for detailed logs.
        </div>
      </div>
    </div>
  );
}
