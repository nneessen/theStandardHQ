// supabase/functions/slack-get-channel-members/index.ts
// Fetches members of a Slack channel for mention autocomplete

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    display_name?: string;
    image_48?: string;
    image_72?: string;
    email?: string;
  };
  is_bot?: boolean;
  deleted?: boolean;
}

interface SlackConversationMembersResponse {
  ok: boolean;
  members?: string[];
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

interface SlackUsersListResponse {
  ok: boolean;
  members?: SlackUser[];
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body = await req.json();
    const { integrationId, channelId } = body;

    if (!integrationId || !channelId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing integrationId or channelId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const integrationResult = await resolveAuthorizedSlackIntegration(
      authContext,
      corsHeaders,
      { integrationId },
    );
    if (integrationResult instanceof Response) {
      return integrationResult;
    }
    const { integration } = integrationResult;

    // Decrypt bot token
    let botToken: string;
    try {
      botToken = await decrypt(integration.bot_token_encrypted);
    } catch (decryptError) {
      console.error(
        "[slack-get-channel-members] Token decryption error:",
        decryptError,
      );
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to decrypt token" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step 1: Get list of member IDs in the channel
    const conversationMembersResponse = await fetch(
      `https://slack.com/api/conversations.members?channel=${channelId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const conversationMembersData: SlackConversationMembersResponse =
      await conversationMembersResponse.json();

    if (!conversationMembersData.ok) {
      console.error(
        "[slack-get-channel-members] Slack API error:",
        conversationMembersData.error,
      );
      return new Response(
        JSON.stringify({
          ok: false,
          slackError: conversationMembersData.error,
          error: `Slack API error: ${conversationMembersData.error}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const memberIds = conversationMembersData.members || [];

    console.log(
      `[slack-get-channel-members] Channel has ${memberIds.length} member IDs:`,
      memberIds,
    );

    // Step 2: Fetch all users from the workspace
    // Note: We fetch all users and filter client-side because Slack doesn't provide
    // a bulk user info API. For large workspaces, consider implementing pagination
    // or caching strategy.
    const usersListResponse = await fetch("https://slack.com/api/users.list", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
    });

    const usersListData: SlackUsersListResponse =
      await usersListResponse.json();

    if (!usersListData.ok) {
      console.error(
        "[slack-get-channel-members] Users list error:",
        usersListData.error,
      );
      return new Response(
        JSON.stringify({
          ok: false,
          slackError: usersListData.error,
          error: `Failed to fetch users: ${usersListData.error}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step 3: Filter to only channel members and exclude bots/deleted users
    const allUsers = usersListData.members || [];
    console.log(
      `[slack-get-channel-members] Workspace has ${allUsers.length} total users`,
    );

    const inChannelUsers = allUsers.filter((user) =>
      memberIds.includes(user.id),
    );
    console.log(
      `[slack-get-channel-members] ${inChannelUsers.length} users are in the channel`,
    );

    const channelMembers = inChannelUsers
      .filter((user) => !user.deleted && !user.is_bot)
      .map((user) => ({
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        profile: {
          display_name: user.profile?.display_name,
          image_48: user.profile?.image_48,
          image_72: user.profile?.image_72,
          email: user.profile?.email,
        },
        is_bot: user.is_bot,
        deleted: user.deleted,
      }));

    console.log(
      `[slack-get-channel-members] Found ${channelMembers.length} members in channel ${channelId}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        members: channelMembers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-get-channel-members] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: {
          ...getCorsHeaders(req.headers.get("origin")),
          "Content-Type": "application/json",
        },
      },
    );
  }
});
