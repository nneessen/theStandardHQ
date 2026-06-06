// Vercel API helper for custom domain management
// Uses platform secrets: VERCEL_API_TOKEN and VERCEL_PROJECT_ID

const VERCEL_API_BASE = "https://api.vercel.com";

export interface VercelDomainResponse {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  configured: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface VercelApiError {
  error: {
    code: string;
    message: string;
    // Present (and true) when the API token itself is invalid/expired/revoked.
    invalidToken?: boolean;
  };
}

function getVercelCredentials(): { token: string; projectId: string } {
  const token = Deno.env.get("VERCEL_API_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");

  if (!token || !projectId) {
    throw new Error("Vercel credentials not configured");
  }

  return { token, projectId };
}

/**
 * Add a domain to the Vercel project
 */
export async function addDomainToVercel(
  hostname: string,
): Promise<{ success: boolean; data?: VercelDomainResponse; error?: string }> {
  try {
    const { token, projectId } = getVercelCredentials();

    const response = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${projectId}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: hostname }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as VercelApiError;
      console.error("[vercel-api] Add domain failed:", errorData);

      // An invalid/expired/revoked API token surfaces as code "forbidden" with
      // invalidToken:true. This is a platform misconfiguration, NOT a user DNS
      // problem — distinguish it so we never tell the user to "add a record".
      if (errorData.error?.invalidToken === true) {
        return {
          success: false,
          error:
            "Custom domain service is misconfigured (invalid Vercel API token). Please contact support.",
        };
      }

      // Handle specific Vercel errors
      if (errorData.error?.code === "domain_already_in_use") {
        // Check if the domain is already on OUR project (not a real conflict)
        const existingStatus = await getDomainStatus(hostname);
        if (existingStatus.success && existingStatus.data) {
          console.log(
            "[vercel-api] Domain already on our project, returning existing data:",
            hostname,
          );
          return { success: true, data: existingStatus.data };
        }

        // It's genuinely on another project
        return {
          success: false,
          error:
            "This domain is already configured on another Vercel project. Please remove it there first.",
        };
      }
      if (errorData.error?.code === "forbidden") {
        return {
          success: false,
          error:
            "Domain verification required by Vercel. Check provider_metadata for details.",
          data: data as VercelDomainResponse,
        };
      }

      return {
        success: false,
        error:
          errorData.error?.message || `Vercel API error: ${response.status}`,
      };
    }

    return { success: true, data: data as VercelDomainResponse };
  } catch (err) {
    console.error("[vercel-api] Add domain exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error adding domain",
    };
  }
}

/**
 * Get domain configuration status from Vercel
 */
export async function getDomainStatus(
  hostname: string,
): Promise<{ success: boolean; data?: VercelDomainResponse; error?: string }> {
  try {
    const { token, projectId } = getVercelCredentials();

    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 404) {
      return { success: false, error: "Domain not found in Vercel project" };
    }

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as VercelApiError;
      return {
        success: false,
        error:
          errorData.error?.message || `Vercel API error: ${response.status}`,
      };
    }

    return { success: true, data: data as VercelDomainResponse };
  } catch (err) {
    console.error("[vercel-api] Get domain status exception:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unknown error checking domain",
    };
  }
}

/**
 * Get domain DNS configuration from Vercel (includes expected CNAME target)
 */
export async function getDomainConfig(hostname: string): Promise<{
  success: boolean;
  data?: {
    configuredBy?: string | null;
    nameservers?: string[];
    serviceType?: string;
    cnames?: string[];
    aValues?: string[];
    conflicts?: unknown[];
    acceptedChallenges?: string[];
    misconfigured?: boolean;
  };
  error?: string;
}> {
  try {
    const { token } = getVercelCredentials();

    // The domain config endpoint gives us the expected DNS configuration
    const response = await fetch(
      `${VERCEL_API_BASE}/v6/domains/${encodeURIComponent(hostname)}/config`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 404) {
      return { success: false, error: "Domain config not found" };
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("[vercel-api] Get domain config failed:", data);
      return {
        success: false,
        error: data.error?.message || `Vercel API error: ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (err) {
    console.error("[vercel-api] Get domain config exception:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unknown error getting domain config",
    };
  }
}

/**
 * Remove a domain from the Vercel project
 */
export async function removeDomainFromVercel(
  hostname: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { token, projectId } = getVercelCredentials();

    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    // 404 is acceptable - domain may already be removed
    if (response.status === 404) {
      console.log("[vercel-api] Domain already removed from Vercel:", hostname);
      return { success: true };
    }

    if (!response.ok) {
      const data = (await response.json()) as VercelApiError;
      return {
        success: false,
        error: data.error?.message || `Vercel API error: ${response.status}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[vercel-api] Remove domain exception:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unknown error removing domain",
    };
  }
}

/**
 * Verify a domain with Vercel (triggers Vercel's verification process)
 */
export async function verifyDomainWithVercel(
  hostname: string,
): Promise<{ success: boolean; data?: VercelDomainResponse; error?: string }> {
  try {
    const { token, projectId } = getVercelCredentials();

    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as VercelApiError;
      return {
        success: false,
        error:
          errorData.error?.message || `Vercel API error: ${response.status}`,
      };
    }

    return { success: true, data: data as VercelDomainResponse };
  } catch (err) {
    console.error("[vercel-api] Verify domain exception:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unknown error verifying domain",
    };
  }
}
