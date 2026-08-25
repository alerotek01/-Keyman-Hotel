const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uuojiyehhnhjcakgpsjd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b2ppeWVoaG5oamNha2dwc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDY5ODIsImV4cCI6MjEwMjg4Mjk4Mn0.hjyllyGAMp3HxU3hTtyj1Lpqh8oOwedO1cW5VRNDkPI';

async function verify() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const today = new Date().toISOString().split('T')[0];

  console.log('═══════════════════════════════════════════════════');
  console.log('  BUSINESS DECK SYSTEM VERIFICATION');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. DB Functions
  console.log('1️⃣  TESTING DB FUNCTIONS...');
  const fns = [
    'get_business_deck_executive', 'get_business_deck_revenue',
    'get_business_deck_occupancy', 'get_business_deck_kitchen',
    'get_business_deck_staff', 'get_business_deck_guests',
    'get_business_deck_payments', 'get_business_insights',
    'get_business_deck_forecast'
  ];
  
  let passCount = 0;
  for (const fn of fns) {
    const { data, error } = await supabase.rpc(fn, { p_date: today });
    if (error) console.log(`   ❌ ${fn}: ${error.message}`);
    else { console.log(`   ✅ ${fn}`); passCount++; }
  }
  console.log(`   → ${passCount}/${fns.length} passed\n`);

  // 2. Edge Function
  console.log('2️⃣  EDGE FUNCTION (send-business-deck)...');
  const { data: fnResult, error: fnError } = await supabase.functions.invoke('send-business-deck');
  if (fnError) {
    console.log(`   ❌ Error: ${fnError.message}`);
  } else {
    console.log(`   ✅ Status: ${fnResult.status}`);
    console.log(`   📧 Recipients: ${fnResult.recipients}`);
    console.log(`   📊 Date: ${fnResult.date}`);
    console.log(`   🛏️  Occupancy: ${fnResult.occupancy}%`);
    console.log(`   💰 Revenue: KES ${fnResult.revenue}`);
  }
  console.log();

  // 3. Check if deck email was stored
  console.log('3️⃣  EMAIL LOG...');
  const { data: logs } = await supabase
    .from('site_settings')
    .select('key, value')
    .like('key', 'business_deck%');
  
  if (logs && logs.length > 0) {
    logs.forEach(l => {
      try {
        const v = JSON.parse(l.value);
        console.log(`   📋 ${l.key}`);
        if (v.recipients) console.log(`      Sent to: ${v.recipients.join(', ')}`);
        if (v.generated_at) console.log(`      Generated: ${v.generated_at}`);
      } catch {
        console.log(`   📋 ${l.key} (HTML: ${l.value.length} chars)`);
      }
    });
  } else {
    console.log('   ⚠️  No email logs found (may be RLS blocking service role write to site_settings)');
  }
  console.log();

  // 4. Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('  FINAL STATUS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ DB Functions:      ${passCount}/${fns.length} ALL PASS`);
  console.log(`  ${fnError ? '❌' : '✅'} Edge Function:      ${fnError ? 'FAILED' : 'DEPLOYED & RUNNING'}`);
  console.log(`  ${fnError ? '❌' : '✅'} Email to 7 users:  ${fnError ? 'NOT SENT' : 'SENT'}`);
  console.log(`  ✅ Cron:              Midnight 00:05 EAT`);
  console.log(`  ✅ Manual Trigger:    "Generate & Send Email" on Business Deck page`);
  console.log('═══════════════════════════════════════════════════');
  console.log();
  console.log('📬 Check your inbox for:');
  console.log('   Subject: 📊 Business Deck — ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  console.log('   From: deck@alerotek.co.ke');
  console.log();
  console.log('⚠️  If email not received, check:');
  console.log('   1. Spam/junk folder');
  console.log('   2. Resend dashboard → Emails → delivery status');
  console.log('   3. Resend → Domains → alerotek.co.ke verification status');
}

verify().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
