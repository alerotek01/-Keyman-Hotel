// Edge Function: admin-create-user
// Creates staff users with proper auth credentials using Supabase Admin API

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    // Verify the caller is authenticated and has admin/manager role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: callerProfile } = await callerClient
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["admin", "manager"].includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient permissions" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name, phone, role } = await req.json();

    if (!email || !full_name || !role) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: email, full_name, role" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (["admin", "manager"].includes(role) && callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Only admins can create admin/manager accounts" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Step 1: Check if email exists in auth.users
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // User exists in auth — just update password and ensure public.users row
      const tempPassword = password || generateTempPassword();
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        existingUser.id,
        { password: tempPassword }
      );

      if (updateError) {
        console.error("[admin-create-user] Update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Upsert public.users row
      await adminClient.from("users").upsert(
        { id: existingUser.id, email, full_name, phone: phone || "", role, is_active: true },
        { onConflict: "id" }
      );

      return new Response(
        JSON.stringify({ success: true, user_id: existingUser.id, has_password: true, temp_password: password ? null : tempPassword }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Step 2: Clean up orphan public.users rows (same email, different/no auth ID)
    // This prevents the trigger from failing on duplicate email
    const { data: orphanRows } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase());

    if (orphanRows && orphanRows.length > 0) {
      for (const row of orphanRows) {
        // Check if this ID exists in auth.users
        const { data: authUser } = await adminClient.auth.admin.getUserById(row.id);
        if (!authUser?.user) {
          // Orphan — delete it so the trigger can create a fresh one
          await adminClient.from("users").delete().eq("id", row.id);
          console.log(`[admin-create-user] Deleted orphan public.users row: ${row.id}`);
        }
      }
    }

    // Step 3: Create auth user (trigger will auto-create public.users)
    const tempPassword = password || generateTempPassword();
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (createError) {
      console.error("[admin-create-user] Create error:", createError);
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure public.users row has correct role (trigger might have set wrong defaults)
    await adminClient.from("users").upsert(
      { id: newUser.user.id, email, full_name, phone: phone || "", role, is_active: true },
      { onConflict: "id" }
    );

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id, has_password: true, temp_password: password ? null : tempPassword }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("[admin-create-user] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}
