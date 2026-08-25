// Edge Function: admin-reset-password
// Resets a user's password using Supabase Admin API (proper auth hash)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { email, new_password, user_id } = await req.json();

    if (!new_password || new_password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 6 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let targetUserId = user_id;

    if (!targetUserId && email) {
      // List users with pagination to find by email
      let page = 1;
      const perPage = 100;
      let found = false;

      while (!found) {
        const { data: users, error } = await adminClient.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) {
          console.error("[admin-reset-password] listUsers error:", error);
          break;
        }

        const match = users?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (match) {
          targetUserId = match.id;
          found = true;
        }

        // If fewer results than perPage, we've reached the end
        if (!users?.users || users.users.length < perPage) break;
        page++;
      }

      if (!found) {
        return new Response(
          JSON.stringify({ success: false, error: "No account found with this email." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email or user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use admin API to update password (proper auth hash)
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: new_password,
    });

    if (error) {
      console.error("[admin-reset-password] Error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure user is active in public.users
    await adminClient
      .from("users")
      .update({ is_active: true })
      .eq("id", targetUserId);

    // Audit log: password reset
    await adminClient.from("audit_logs").insert({
      user_id: targetUserId,
      action: "password_reset",
      table_name: "auth.users",
      record_id: targetUserId,
      new_data: { email, method: "otp_verified", reset_by: email },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: targetUserId }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("[admin-reset-password] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
