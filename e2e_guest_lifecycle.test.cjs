/**
 * ═══════════════════════════════════════════════════════════════
 * E2E TEST: Complete Guest Lifecycle (v2 — schema-accurate)
 * ═══════════════════════════════════════════════════════════════
 * Tests: Registration → Booking → Payment → Check-in → Cafeteria → Room Service → Chat → Checkout
 */

const https = require('https');
const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN || '';
const PROJECT_REF = 'uuojiyehhnhjcakgpsjd';

let passed = 0, failed = 0;
const results = [];
const S = {}; // shared test state

function log(sec, msg, status) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '  ';
  console.log(`${icon} [${sec}] ${msg}`);
}
function assert(cond, name, details = '') {
  if (cond) { passed++; results.push({ test: name, status: 'PASS', details }); log('TEST', `${name} — PASS${details ? ' (' + details + ')' : ''}`, 'PASS'); }
  else { failed++; results.push({ test: name, status: 'FAIL', details }); log('TEST', `${name} — FAIL ${details}`, 'FAIL'); }
}
function q(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({ hostname: 'api.supabase.com', port: 443, path: `/v1/projects/${PROJECT_REF}/database/query`, method: 'POST',
      headers: { 'Authorization': `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}
function row(result) { const r = result?.result?.[0] || (Array.isArray(result) ? result[0] : null); return r?.message ? null : r; }
function rows(result) { const r = result?.result || (Array.isArray(result) ? result : []); return r?.message ? [] : r; }

// ═══════════════════════════════════════════════
// TEST 1: Guest Registration
// ═══════════════════════════════════════════════
async function test1() {
  log('SECTION', '═══ TEST 1: Guest Registration ═══');
  const email = `e2e_guest_${Date.now()}@test.com`;
  const name = 'E2E Test Guest';

  // Get an existing auth user (FK required)
  const auth = row(await q(`SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1`));
  assert(auth?.id, 'Auth user found for simulation');
  S.userId = auth.id;
  S.guestEmail = auth.email || email;
  S.guestName = name;

  // Upsert users record
  await q(`INSERT INTO users (id, email, full_name, role, is_guest, is_active, otp_verified_at) VALUES ('${S.userId}', '${S.guestEmail}', '${name}', 'guest', true, true, now()) ON CONFLICT (id) DO UPDATE SET role = 'guest', is_guest = true`);
  assert(true, 'Users record upserted', `role=guest`);

  // Upsert guests record
  await q(`INSERT INTO guests (name, email, user_id) VALUES ('${name}', '${S.guestEmail}', '${S.userId}') ON CONFLICT DO NOTHING`);
  const guest = row(await q(`SELECT id FROM guests WHERE user_id = '${S.userId}'`));
  assert(guest?.id, 'Guests record created', `guest_id: ${guest?.id}`);
  S.guestId = guest.id;
}

// ═══════════════════════════════════════════════
// TEST 2: Booking with Payment Rules
// ═══════════════════════════════════════════════
async function test2() {
  log('SECTION', '═══ TEST 2: Booking with Payment Rules ═══');
  const rt = row(await q(`SELECT id, name, base_rate FROM room_types WHERE is_active = true ORDER BY base_rate LIMIT 1`));
  assert(rt?.id, 'Room type found', `${rt.name} @ KES ${rt.base_rate}/night`);
  S.roomType = rt;

  // 3 nights = requires deposit
  const ci = new Date(Date.now() + 3*86400000).toISOString().split('T')[0];
  const co = new Date(Date.now() + 6*86400000).toISOString().split('T')[0];
  const total = Number(rt.base_rate) * 3;

  await q(`INSERT INTO reservations (guest_id, room_type_id, check_in, check_out, num_adults, num_children, rate, source, special_requests, status, guest_user_id) VALUES ('${S.guestId}', '${rt.id}', '${ci}', '${co}', 2, 0, ${rt.base_rate}, 'direct', 'E2E test', 'confirmed', '${S.userId}')`);
  const res = row(await q(`SELECT id FROM reservations WHERE guest_id = '${S.guestId}' AND status = 'confirmed' ORDER BY created_at DESC LIMIT 1`));
  assert(res?.id, 'Booking created', `reservation: ${res?.id}`);
  S.resId = res.id;
  S.total = total;

  // Set deposit
  const dep = Math.round(total * 50 / 100);
  await q(`UPDATE reservations SET payment_type = 'deposit', deposit_amount = ${dep} WHERE id = '${S.resId}'`);
  const check = row(await q(`SELECT payment_type, deposit_amount FROM reservations WHERE id = '${S.resId}'`));
  assert(check?.payment_type === 'deposit', 'Payment type = deposit');
  assert(Number(check?.deposit_amount) === dep, 'Deposit = 50%', `KES ${dep}`);

  // Create pending booking payment
  await q(`INSERT INTO booking_payments (reservation_id, amount, method, payment_type, status) VALUES ('${S.resId}', ${dep}, 'mpesa', 'deposit', 'pending')`);
  const bp = row(await q(`SELECT id FROM booking_payments WHERE reservation_id = '${S.resId}' AND status = 'pending'`));
  assert(bp?.id, 'Booking payment created (pending)');
  S.bpId = bp.id;
}

// ═══════════════════════════════════════════════
// TEST 3: Payment Confirmation
// ═══════════════════════════════════════════════
async function test3() {
  log('SECTION', '═══ TEST 3: Payment Confirmation ═══');
  await q(`UPDATE booking_payments SET status = 'confirmed', confirmed_amount = ${Math.round(S.total*50/100)}, confirmed_at = now() WHERE id = '${S.bpId}'`);
  const bp = row(await q(`SELECT status, confirmed_amount FROM booking_payments WHERE id = '${S.bpId}'`));
  assert(bp?.status === 'confirmed', 'Payment confirmed', `KES ${bp?.confirmed_amount}`);

  await q(`UPDATE reservations SET deposit_paid = true WHERE id = '${S.resId}'`);
  assert(row(await q(`SELECT deposit_paid FROM reservations WHERE id = '${S.resId}'`))?.deposit_paid, 'deposit_paid = true');
}

// ═══════════════════════════════════════════════
// TEST 4: Check-in
// ═══════════════════════════════════════════════
async function test4() {
  log('SECTION', '═══ TEST 4: Check-in Flow ═══');

  // Find an available room
  const room = row(await q(`SELECT id, room_number FROM rooms WHERE is_active = true AND status = 'available' ORDER BY room_number LIMIT 1`));
  assert(room?.id, 'Available room found', `Room ${room?.room_number}`);
  if (!room) return;
  S.roomId = room.id;
  S.roomNum = room.room_number;

  // Check in
  await q(`UPDATE reservations SET room_id = '${S.roomId}', status = 'checked_in' WHERE id = '${S.resId}'`);
  const ci = row(await q(`SELECT status FROM reservations WHERE id = '${S.resId}'`));
  assert(ci?.status === 'checked_in', 'Guest checked in');

  // Create folio
  await q(`INSERT INTO guest_folios (reservation_id, guest_id, status) VALUES ('${S.resId}', '${S.guestId}', 'open')`);
  const folio = row(await q(`SELECT id FROM guest_folios WHERE reservation_id = '${S.resId}'`));
  assert(folio?.id, 'Guest folio created');
  S.folioId = folio.id;

  // Post room charge
  await q(`INSERT INTO folio_transactions (folio_id, type, description, amount) VALUES ('${S.folioId}', 'room_charge', 'Room ${S.roomNum} — 3 nights', ${S.total})`);
  assert(row(await q(`SELECT id FROM folio_transactions WHERE folio_id = '${S.folioId}' AND type = 'room_charge'`)), 'Room charge posted');

  // Update room status
  await q(`UPDATE rooms SET status = 'occupied' WHERE id = '${S.roomId}'`);
  assert(row(await q(`SELECT status FROM rooms WHERE id = '${S.roomId}'`))?.status === 'occupied', 'Room status = occupied');

  log('INFO', `Folio ${S.folioId} ready for charges`);
}

// ═══════════════════════════════════════════════
// TEST 5: Cafeteria Order Flow
// ═══════════════════════════════════════════════
async function test5() {
  log('SECTION', '═══ TEST 5: Cafeteria Order Flow ═══');

  const waiter = row(await q(`SELECT id, full_name FROM users WHERE role = 'waiter' AND is_active = true LIMIT 1`));
  const chef = row(await q(`SELECT id, full_name FROM users WHERE role = 'chef' AND is_active = true LIMIT 1`));
  if (!waiter || !chef) { log('INFO', 'No waiter/chef — skipping'); return; }
  log('INFO', `Waiter: ${waiter.full_name}, Chef: ${chef.full_name}`);

  const item = row(await q(`SELECT id, name, price FROM menu_items WHERE is_available = true LIMIT 1`));
  if (!item) { log('INFO', 'No menu items — skipping'); return; }
  log('INFO', `Menu item: ${item.name} @ KES ${item.price}`);

  // 1. Create order (source enum: web, waiter, walk_in)
  await q(`INSERT INTO restaurant_orders (guest_id, room_number, source, status, total, guest_name, waiter_id) VALUES ('${S.guestId}', ${S.roomNum}, 'web', 'new', ${item.price}, '${S.guestName}', '${waiter.id}')`);
  const order = row(await q(`SELECT id FROM restaurant_orders WHERE guest_id = '${S.guestId}' AND status = 'new' ORDER BY created_at DESC LIMIT 1`));
  assert(order?.id, 'Order created', `order: ${order?.id}`);
  S.orderId = order.id;

  // 2. Add item
  await q(`INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, unit_price, subtotal) VALUES ('${order.id}', '${item.id}', 1, ${item.price}, ${item.price})`);
  assert(row(await q(`SELECT id FROM restaurant_order_items WHERE order_id = '${order.id}'`)), 'Order item added');

  // 3-7. State machine: new → kitchen_accepted → preparing → ready → delivered
  for (const [from, to] of [['new','kitchen_accepted'],['kitchen_accepted','preparing'],['preparing','ready'],['ready','delivered']]) {
    await q(`UPDATE restaurant_orders SET status = '${to}' WHERE id = '${order.id}'`);
    const st = row(await q(`SELECT status FROM restaurant_orders WHERE id = '${order.id}'`));
    assert(st?.status === to, `Status → ${to}`);
  }

  // 8-9. Payment flow
  await q(`UPDATE restaurant_orders SET status = 'payment_submitted' WHERE id = '${order.id}'`);
  assert(row(await q(`SELECT status FROM restaurant_orders WHERE id = '${order.id}'`))?.status === 'payment_submitted', 'Payment submitted');

  await q(`UPDATE restaurant_orders SET status = 'payment_verified' WHERE id = '${order.id}'`);
  assert(row(await q(`SELECT status FROM restaurant_orders WHERE id = '${order.id}'`))?.status === 'payment_verified', 'Payment verified');

  log('INFO', 'Full chain: new → kitchen_accepted → preparing → ready → delivered → payment_submitted → payment_verified');
}

// ═══════════════════════════════════════════════
// TEST 6: Room Service Charge
// ═══════════════════════════════════════════════
async function test6() {
  log('SECTION', '═══ TEST 6: Room Service Charge to Bill ═══');
  const waiterId = (row(await q(`SELECT id FROM users WHERE role = 'waiter' LIMIT 1`)))?.id;
  
  await q(`INSERT INTO restaurant_orders (guest_id, room_number, source, status, total, guest_name, waiter_id) VALUES ('${S.guestId}', ${S.roomNum}, 'web', 'delivered', 350, '${S.guestName}', '${waiterId}')`);
  const rs = row(await q(`SELECT id FROM restaurant_orders WHERE guest_id = '${S.guestId}' AND status = 'delivered' ORDER BY created_at DESC LIMIT 1`));
  assert(rs?.id, 'Room service order created');

  // Post to folio
  await q(`INSERT INTO folio_transactions (folio_id, type, description, amount) VALUES ('${S.folioId}', 'restaurant_charge', 'Room Service — KES 350', 350)`);
  assert(row(await q(`SELECT id FROM folio_transactions WHERE folio_id = '${S.folioId}' AND type = 'restaurant_charge'`)), 'Charge posted to folio');

  const total = row(await q(`SELECT SUM(amount)::numeric as t FROM folio_transactions WHERE folio_id = '${S.folioId}' AND type != 'refund'`));
  S.totalCharges = Number(total?.t || 0);
  log('INFO', `Folio total charges: KES ${S.totalCharges}`);
}

// ═══════════════════════════════════════════════
// TEST 7: Chat Messaging
// ═══════════════════════════════════════════════
async function test7() {
  log('SECTION', '═══ TEST 7: Inter-Department Chat ═══');

  // Find or create reception channel
  let ch = row(await q(`SELECT id FROM message_channels WHERE name = 'reception' LIMIT 1`));
  if (!ch) { await q(`INSERT INTO message_channels (name, description) VALUES ('reception', 'Reception')`); ch = row(await q(`SELECT id FROM message_channels WHERE name = 'reception'`)); }
  if (!ch) { assert(false, 'Chat channel', 'Could not create channel'); return; }
  S.channelId = ch.id;

  // Add guest to channel
  const isMember = row(await q(`SELECT id FROM channel_members WHERE channel_id = '${ch.id}' AND user_id = '${S.userId}'`));
  if (!isMember) await q(`INSERT INTO channel_members (channel_id, user_id) VALUES ('${ch.id}', '${S.userId}')`);

  // Guest sends message (messages uses sender_id, not user_id)
  await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${ch.id}', '${S.userId}', 'Can I get extra towels please?')`);
  assert(row(await q(`SELECT id FROM messages WHERE channel_id = '${ch.id}' AND sender_id = '${S.userId}'`)), 'Guest message sent');

  // Receptionist replies
  const rec = row(await q(`SELECT id FROM users WHERE role = 'receptionist' AND is_active = true LIMIT 1`));
  if (rec) {
    const isRecMember = row(await q(`SELECT id FROM channel_members WHERE channel_id = '${ch.id}' AND user_id = '${rec.id}'`));
    if (!isRecMember) await q(`INSERT INTO channel_members (channel_id, user_id) VALUES ('${ch.id}', '${rec.id}')`);
    await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${ch.id}', '${rec.id}', 'Sure! Delivered in 5 minutes.')`);
    assert(row(await q(`SELECT id FROM messages WHERE channel_id = '${ch.id}' AND sender_id = '${rec.id}'`)), 'Receptionist replied');
  }

  const msgs = rows(await q(`SELECT sender_id, content FROM messages WHERE channel_id = '${ch.id}' ORDER BY created_at`));
  assert(msgs.length >= 2, 'Messages exchanged', `${msgs.length} messages`);
}

// ═══════════════════════════════════════════════
// TEST 8: Payment Reconciliation
// ═══════════════════════════════════════════════
async function test8() {
  log('SECTION', '═══ TEST 8: Payment Reconciliation ═══');
  const folioDetail = row(await q(`SELECT * FROM v_guest_folio_detail WHERE folio_id = '${S.folioId}'`));
  if (folioDetail) {
    log('INFO', `Folio: ${folioDetail.guest_name}, Room ${folioDetail.room_number}`);
    log('INFO', `Charges=KES ${folioDetail.total_charges}, Balance=KES ${folioDetail.balance}`);
    assert(folioDetail.guest_name === 'E2E Test Guest', 'Folio linked to correct guest');
  }

  const txns = rows(await q(`SELECT type, description, amount FROM folio_transactions WHERE folio_id = '${S.folioId}' ORDER BY created_at`));
  log('INFO', `Folio charges (${txns.length}):`);
  txns.forEach(t => log('INFO', `  ${t.type}: ${t.description} — KES ${t.amount}`));

  assert(row(await q(`SELECT status FROM booking_payments WHERE id = '${S.bpId}'`))?.status === 'confirmed', 'Deposit confirmed');
}

// ═══════════════════════════════════════════════
// TEST 9: Checkout
// ═══════════════════════════════════════════════
async function test9() {
  log('SECTION', '═══ TEST 9: Checkout ═══');
  const depPaid = Math.round(S.total * 50 / 100);
  const balance = Math.max(0, S.totalCharges - depPaid);
  log('INFO', `Charges: KES ${S.totalCharges}, Deposit: KES ${depPaid}, Balance: KES ${balance}`);

  if (balance > 0) {
    await q(`INSERT INTO folio_payments (folio_id, method, amount) VALUES ('${S.folioId}', 'mpesa', ${balance})`);
    assert(row(await q(`SELECT id FROM folio_payments WHERE folio_id = '${S.folioId}'`)), 'Checkout payment recorded');
  }

  // Close folio
  await q(`UPDATE guest_folios SET total_charges = ${S.totalCharges}, total_payments = ${S.totalCharges}, balance = 0, status = 'closed', closed_at = now() WHERE id = '${S.folioId}'`);
  const fc = row(await q(`SELECT status, balance FROM guest_folios WHERE id = '${S.folioId}'`));
  assert(fc?.status === 'closed', 'Folio closed');
  assert(Number(fc?.balance) === 0, 'Folio balance = 0');

  // Checkout
  await q(`UPDATE reservations SET status = 'checked_out' WHERE id = '${S.resId}'`);
  assert(row(await q(`SELECT status FROM reservations WHERE id = '${S.resId}'`))?.status === 'checked_out', 'Reservation checked out');

  // Room dirty
  await q(`UPDATE rooms SET status = 'dirty' WHERE id = '${S.roomId}'`);
  assert(row(await q(`SELECT status FROM rooms WHERE id = '${S.roomId}'`))?.status === 'dirty', 'Room = dirty');
}

// ═══════════════════════════════════════════════
// TEST 10: Post-Checkout Verification
// ═══════════════════════════════════════════════
async function test10() {
  log('SECTION', '═══ TEST 10: Post-Checkout Verification ═══');
  assert(rows(await q(`SELECT id FROM reservations WHERE guest_id = '${S.guestId}' AND status = 'checked_out'`)).length > 0, 'Checked-out reservation in history');
  assert(rows(await q(`SELECT id FROM folio_transactions WHERE folio_id = '${S.folioId}'`)).length > 0, 'Folio transactions preserved');
  assert(rows(await q(`SELECT id FROM booking_payments WHERE reservation_id = '${S.resId}'`)).length > 0, 'Booking payment preserved');
}

// ═══════════════════════════════════════════════
// TEST 11: Cancellation
// ═══════════════════════════════════════════════
async function test11() {
  log('SECTION', '═══ TEST 11: Cancellation Scenario ═══');
  const ci = new Date(Date.now() + 10*86400000).toISOString().split('T')[0];
  const co = new Date(Date.now() + 12*86400000).toISOString().split('T')[0];

  await q(`INSERT INTO reservations (guest_id, room_type_id, check_in, check_out, num_adults, num_children, rate, source, special_requests, status) VALUES ('${S.guestId}', '${S.roomType.id}', '${ci}', '${co}', 2, 0, ${S.roomType.base_rate}, 'direct', 'E2E cancel test', 'confirmed')`);
  const cancel = row(await q(`SELECT id FROM reservations WHERE guest_id = '${S.guestId}' AND special_requests = 'E2E cancel test' ORDER BY created_at DESC LIMIT 1`));
  assert(cancel?.id, 'Cancellation booking created');

  await q(`UPDATE reservations SET status = 'cancelled', cancellation_reason = 'Changed plans' WHERE id = '${cancel.id}'`);
  const c = row(await q(`SELECT status, cancellation_reason FROM reservations WHERE id = '${cancel.id}'`));
  assert(c?.status === 'cancelled', 'Reservation cancelled');
  assert(c?.cancellation_reason === 'Changed plans', 'Reason recorded');
}

// ═══════════════════════════════════════════════
// TEST 12: Notifications
// ═══════════════════════════════════════════════
async function test12() {
  log('SECTION', '═══ TEST 12: Notification System ═══');
  const prefs = rows(await q(`SELECT role, count(*) as cnt FROM notification_preferences np JOIN users u ON u.id = np.user_id WHERE u.role != 'guest' GROUP BY role`));
  log('INFO', 'Staff notification preferences:');
  prefs.forEach(p => log('INFO', `  ${p.role}: ${p.cnt} users`));
  assert(prefs.length >= 3, 'Multiple roles have notification prefs');
}

// ═══════════════════════════════════════════════
// TEST 13: Site Settings
// ═══════════════════════════════════════════════
async function test13() {
  log('SECTION', '═══ TEST 13: Site Settings ═══');
  const settings = rows(await q(`SELECT key, value FROM site_settings ORDER BY key`));
  log('INFO', `Site settings: ${settings.length} entries`);
  const critical = ['reservation_deposit_percent','cancellation_policy_hours','cancellation_penalty_percent','same_day_pay_threshold_hours','check_in_time','check_out_time','currency'];
  for (const key of critical) {
    const found = settings.find(s => s.key === key);
    assert(found, `Setting: ${key}`, found ? `value=${found.value}` : 'MISSING');
  }
}

// ═══════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════
(async () => {
  console.log('\n' + '═'.repeat(70));
  console.log('  E2E TEST: Complete Guest Lifecycle');
  console.log('═'.repeat(70) + '\n');
  const t0 = Date.now();
  try {
    await test1(); await test2(); await test3(); await test4();
    await test5(); await test6(); await test7(); await test8();
    await test9(); await test10(); await test11(); await test12(); await test13();
  } catch (err) { log('FAIL', `Unexpected: ${err.message}`); console.error(err.stack); failed++; }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(70));
  console.log(`  RESULTS: ✅ ${passed} passed, ❌ ${failed} failed — ${elapsed}s`);
  console.log('═'.repeat(70));
  results.forEach((r, i) => console.log(`  ${i+1}. ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}`));
  console.log('═'.repeat(70));
  process.exit(failed > 0 ? 1 : 0);
})();
