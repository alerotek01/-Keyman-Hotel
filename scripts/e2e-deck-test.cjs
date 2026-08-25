// ═══════════════════════════════════════════════════════════════
// E2E Test: Business Deck Generate & Send
// Simulates exactly what happens when admin clicks the button
// ═══════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uuojiyehhnhjcakgpsjd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b2ppeWVoaG5oamNha2dwc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDY5ODIsImV4cCI6MjEwMjg4Mjk4Mn0.hjyllyGAMp3HxU3hTtyj1Lpqh8oOwedO1cW5VRNDkPI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const today = new Date().toISOString().split('T')[0];
const dateLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

async function e2eTest() {
  const results = [];
  const pass = (name) => { results.push({ name, status: '✅ PASS' }); console.log(`  ✅ ${name}`); };
  const fail = (name, err) => { results.push({ name, status: '❌ FAIL', error: err }); console.log(`  ❌ ${name}: ${err}`); };

  console.log('═══════════════════════════════════════════════════');
  console.log('  E2E TEST: Business Deck Generate & Send');
  console.log('  Date:', dateLabel);
  console.log('═══════════════════════════════════════════════════\n');

  // ── Step 1: Page loads data (9 DB functions) ──
  console.log('Step 1: Page loads — fetch all 9 data sources...');
  const fns = [
    'get_business_deck_executive',
    'get_business_deck_revenue',
    'get_business_deck_occupancy',
    'get_business_deck_kitchen',
    'get_business_deck_staff',
    'get_business_deck_guests',
    'get_business_deck_payments',
    'get_business_insights',
    'get_business_deck_forecast',
  ];

  let allFnPass = true;
  for (const fn of fns) {
    const { data, error } = await supabase.rpc(fn, { p_date: today });
    if (error) { allFnPass = false; fail(`DB: ${fn}`, error.message); }
  }
  if (allFnPass) pass('All 9 DB functions loaded successfully');

  // ── Step 2: Button click → triggers Edge Function ──
  console.log('\nStep 2: Click "Generate & Send Email" button...');
  const startTime = Date.now();
  const { data: fnResult, error: fnError } = await supabase.functions.invoke('send-business-deck');
  const duration = Date.now() - startTime;

  if (fnError) {
    fail('Edge Function invocation', fnError.message);
  } else {
    pass(`Edge Function responded in ${duration}ms`);
  }

  // ── Step 3: Verify email was sent ──
  console.log('\nStep 3: Verify email delivery...');
  if (fnResult?.status === 'success' || fnResult?.status === 'partial') {
    pass(`Email status: ${fnResult.status}`);
    pass(`Recipients: ${fnResult.recipients}`);
    pass(`Email ID: ${fnResult.email_id || 'N/A'}`);
    pass(`Tracking: open=${fnResult.tracking?.open}, click=${fnResult.tracking?.click}`);
  } else {
    fail('Email delivery', `Status: ${fnResult?.status}`);
  }

  // ── Step 4: Verify response matches what UI would display ──
  console.log('\nStep 4: Verify response data integrity...');
  if (fnResult?.date === today) pass('Date matches today');
  else fail('Date mismatch', `Expected ${today}, got ${fnResult?.date}`);

  if (typeof fnResult?.occupancy === 'number') pass('Occupancy is numeric');
  else fail('Occupancy type', typeof fnResult?.occupancy);

  if (typeof fnResult?.revenue === 'number') pass('Revenue is numeric');
  else fail('Revenue type', typeof fnResult?.revenue);

  // ── Step 5: Verify tracking is enabled ──
  console.log('\nStep 5: Verify tracking configuration...');
  if (fnResult?.tracking?.open === true) pass('Open tracking enabled');
  else fail('Open tracking', 'Not enabled');

  if (fnResult?.tracking?.click === true) pass('Click tracking enabled');
  else fail('Click tracking', 'Not enabled');

  if (fnResult?.email_id) pass(`Resend email ID for status lookup: ${fnResult.email_id}`);
  else fail('Email ID', 'Not returned');

  // ── Summary ──
  const totalPass = results.filter(r => r.status.includes('PASS')).length;
  const totalFail = results.filter(r => r.status.includes('FAIL')).length;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  E2E TEST RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ Passed: ${totalPass}`);
  console.log(`  ❌ Failed: ${totalFail}`);
  console.log(`  ⏱️  Total time: ${duration}ms`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📬 Check inbox for:`);
  console.log(`   Subject: 📊 Business Deck — ${dateLabel}`);
  console.log(`   From: deck@alerotek.co.ke`);
  console.log(`   Email ID: ${fnResult?.email_id}`);
  console.log(`\n📊 Resend tracking dashboard:`);
  console.log(`   https://resend.com/emails/${fnResult?.email_id}`);

  return { totalPass, totalFail, results };
}

e2eTest().catch(e => {
  console.error('E2E Test crashed:', e.message);
  process.exit(1);
});
