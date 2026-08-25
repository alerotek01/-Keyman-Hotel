// ═══════════════════════════════════════════════════════════════
// Business Deck System Verification
// Checks: cron jobs, recipients, Edge Function, email delivery
// ═══════════════════════════════════════════════════════════════

const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const DB_URL = 'postgresql://postgres:-u!K4M8XLAjdy+K@db.uuojiyehhnhjcakgpsjd.supabase.co:5432/postgres';
const SUPABASE_URL = 'https://uuojiyehhnhjcakgpsjd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b2ppeWVoaG5oamNha2dwc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDY5ODIsImV4cCI6MjEwMjg4Mjk4Mn0.hjyllyGAMp3HxU3hTtyj1Lpqh8oOwedO1cW5VRNDkPI';

async function verify() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  BUSINESS DECK SYSTEM VERIFICATION');
  console.log('═══════════════════════════════════════════════════\n');

  // ── 1. Database Functions ──
  console.log('1️⃣  TESTING DB FUNCTIONS...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const today = new Date().toISOString().split('T')[0];
  
  const fns = [
    'get_business_deck_executive',
    'get_business_deck_revenue',
    'get_business_deck_occupancy',
    'get_business_deck_kitchen',
    'get_business_deck_staff',
    'get_business_deck_guests',
    'get_business_deck_payments',
    'get_business_insights',
    'get_business_deck_forecast'
  ];
  
  let passCount = 0;
  for (const fn of fns) {
    const { data, error } = await supabase.rpc(fn, { p_date: today });
    if (error) {
      console.log(`   ❌ ${fn}: ${error.message}`);
    } else {
      console.log(`   ✅ ${fn}`);
      passCount++;
    }
  }
  console.log(`   → ${passCount}/${fns.length} passed\n`);

  // ── 2. Recipients ──
  console.log('2️⃣  EMAIL RECIPIENTS...');
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const recipRes = await client.query('SELECT * FROM get_deck_recipients()');
  console.log(`   Found ${recipRes.rows.length} active admins/managers:`);
  recipRes.rows.forEach(r => {
    console.log(`   📧 ${r.full_name} <${r.email}> (${r.role})`);
  });
  console.log();

  // ── 3. Cron Jobs ──
  console.log('3️⃣  CRON JOBS...');
  const cronRes = await client.query('SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid');
  if (cronRes.rows.length === 0) {
    console.log('   ⚠️  No cron jobs found!');
  } else {
    cronRes.rows.forEach(r => {
      console.log(`   📅 ${r.jobname} | Schedule: ${r.schedule} | Active: ${r.active}`);
    });
  }

  // Check cron run history
  const logRes = await client.query('SELECT jobid, start_time, end_time, status, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5');
  if (logRes.rows.length > 0) {
    console.log('\n   Recent cron runs:');
    logRes.rows.forEach(r => {
      console.log(`   → ${r.status} at ${r.start_time?.toISOString()?.split('T')[0]} ${r.start_time?.toISOString()?.split('T')[1]?.substring(0, 8)}`);
      if (r.return_message) console.log(`     ${r.return_message.substring(0, 150)}`);
    });
  } else {
    console.log('   (no runs yet — will fire at next scheduled time)');
  }
  console.log();

  // ── 4. Edge Function ──
  console.log('4️⃣  EDGE FUNCTION TEST...');
  const { data: fnResult, error: fnError } = await supabase.functions.invoke('send-business-deck');
  if (fnError) {
    console.log(`   ❌ Error: ${fnError.message}`);
  } else {
    console.log(`   ✅ Edge Function responded:`);
    console.log(`      Status: ${fnResult.status}`);
    console.log(`      Date: ${fnResult.date}`);
    console.log(`      Recipients: ${fnResult.recipients}`);
    console.log(`      Occupancy: ${fnResult.occupancy}%`);
    console.log(`      Revenue: KES ${fnResult.revenue}`);
  }
  console.log();

  // ── 5. Summary ──
  console.log('═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  DB Functions:  ${passCount}/${fns.length} ✅`);
  console.log(`  Recipients:    ${recipRes.rows.length} emails`);
  console.log(`  Cron Jobs:     ${cronRes.rows.length} scheduled`);
  console.log(`  Edge Function: ${fnError ? '❌' : '✅'}`);
  console.log(`  Email Delivery: Check inbox for 📊 Business Deck email`);
  console.log('═══════════════════════════════════════════════════');

  await client.end();
}

verify().catch(e => {
  console.error('Verification failed:', e.message);
  process.exit(1);
});
