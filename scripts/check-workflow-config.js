// /home/nneessen/projects/commissionTracker/scripts/check-workflow-config.js
// Script to check workflow configuration in database

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pcyaqwodnyrpkaiojnpz.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeWFxd29kbnlycGthaW9qbnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzEwOTIsImV4cCI6MjA3MzU0NzA5Mn0.4p4k0ysuStPsqWzVQhlWona0mQaebdbX_lEvrFUJxZI";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorkflowConfig() {
  console.log("🔍 Checking Workflow Configuration\n");
  console.log("=".repeat(50));

  // Get all workflows
  const { data: workflows, error: wfError } = await supabase
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: false });

  if (wfError) {
    console.error("❌ Error fetching workflows:", wfError);
    return;
  }

  console.log(`\n📋 Found ${workflows.length} workflows:\n`);

  for (const workflow of workflows) {
    console.log(`\n📌 Workflow: ${workflow.name}`);
    console.log(`   ID: ${workflow.id}`);
    console.log(`   Status: ${workflow.status}`);
    console.log(`   Trigger Type: ${workflow.trigger_type}`);

    // Check actions
    if (workflow.actions && workflow.actions.length > 0) {
      console.log(`   Actions (${workflow.actions.length}):`);

      workflow.actions.forEach((action, index) => {
        console.log(`\n   Action ${index + 1}:`);
        console.log(`      Type: ${action.type}`);
        console.log(`      Config:`, JSON.stringify(action.config, null, 2));

        if (action.type === "send_email") {
          if (!action.config.templateId) {
            console.log(`      ⚠️ WARNING: No templateId in config!`);
          }
          if (!action.config.recipientType) {
            console.log(`      ⚠️ WARNING: No recipientType in config!`);
          }
        }
      });
    } else {
      console.log("   ❌ No actions configured!");
    }
  }

  // Check email templates
  console.log("\n\n📧 Email Templates:");
  console.log("=".repeat(50));

  const { data: templates, error: tmplError } = await supabase
    .from("email_templates")
    .select("id, name, subject, is_active")
    .order("created_at", { ascending: false });

  if (tmplError) {
    console.error("❌ Error fetching templates:", tmplError);
    return;
  }

  if (templates.length === 0) {
    console.log("❌ No email templates found!");
  } else {
    templates.forEach((template) => {
      console.log(`\n   Template: ${template.name}`);
      console.log(`      ID: ${template.id}`);
      console.log(`      Subject: ${template.subject}`);
      console.log(`      Active: ${template.is_active ? "✅" : "❌"}`);
    });
  }

  // Check Gmail connections
  console.log("\n\n🔗 Gmail Connections:");
  console.log("=".repeat(50));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: oauthTokens, error: oauthError } = await supabase
      .from("user_email_oauth_tokens")
      .select("provider, email_address, is_active, last_used_at")
      .eq("provider", "gmail");

    if (oauthError) {
      console.error("❌ Error fetching OAuth tokens:", oauthError);
    } else if (!oauthTokens || oauthTokens.length === 0) {
      console.log("❌ No Gmail connection found!");
      console.log("   You need to connect Gmail in Settings > Email");
    } else {
      oauthTokens.forEach((token) => {
        console.log(`\n   Gmail Account: ${token.email_address}`);
        console.log(`      Active: ${token.is_active ? "✅" : "❌"}`);
        console.log(`      Last Used: ${token.last_used_at || "Never"}`);
      });
    }
  } else {
    console.log("❌ Not authenticated - run this while logged in");
  }

  // Check recent workflow runs
  console.log("\n\n🏃 Recent Workflow Runs:");
  console.log("=".repeat(50));

  const { data: runs, error: runError } = await supabase
    .from("workflow_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);

  if (runError) {
    console.error("❌ Error fetching runs:", runError);
    return;
  }

  if (runs.length === 0) {
    console.log("No workflow runs found");
  } else {
    runs.forEach((run) => {
      console.log(`\n   Run ID: ${run.id}`);
      console.log(`      Status: ${run.status}`);
      console.log(`      Started: ${run.started_at}`);
      console.log(
        `      Actions Executed: ${run.actions_executed?.length || 0}`,
      );
      console.log(`      Actions Failed: ${run.actions_failed || 0}`);

      if (run.error_message) {
        console.log(`      ❌ Error: ${run.error_message}`);
      }

      if (run.actions_executed && run.actions_executed.length > 0) {
        console.log(`      Action Results:`);
        run.actions_executed.forEach((action) => {
          console.log(`         - ${action.actionType}: ${action.status}`);
          if (action.error) {
            console.log(`           Error: ${action.error}`);
          }
        });
      }
    });
  }

  console.log("\n\n✅ Diagnostic complete!");
  console.log("\nCommon issues to check:");
  console.log(
    "1. Workflow has no actions or action config is missing templateId/recipientType",
  );
  console.log("2. No email templates created");
  console.log("3. Gmail not connected in Settings > Email");
  console.log("4. Check Supabase Dashboard logs for edge function errors");
}

checkWorkflowConfig().catch(console.error);

