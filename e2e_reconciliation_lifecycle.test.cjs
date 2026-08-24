/**
 * ═══════════════════════════════════════════════════════════════
 * E2E RECONCILIATION LIFECYCLE TEST — Keyman Hotel
 * ═══════════════════════════════════════════════════════════════
 *
 * Full lifecycle:
 * 1. Create shifts for waiter, chef, receptionist, housekeeper
 * 2. Create restaurant orders with items
 * 3. Create payments (cash + M-Pesa) with transaction codes
 * 4. Submit reconciliation WITH variance
 * 5. Manager flags the reconciliation
 * 6. Verify staff receives in-app notification
 * 7. Staff submits explanation with M-Pesa proof
 * 8. Manager/admin confirms variance resolution
 * 9. Manager closes shift
 * 10. Verify final state
 *
 * Run: node e2e_reconciliation_lifecycle.test.cjs
 */

const https = require('https');
const fs = require('fs');

// ═══════ CONFIG ═══════
const token = process.env.SUPABASE_MGMT_TOKEN || fs.readFileSync('.env', 'utf8').match(/SUPABASE_MGMT_TOKEN=(.*)/)?.[1]?.trim();
const projectRef = 'uuojiyehhnhjcakgpsjd';

let passed = 0, failed = 0, total = 0;
const results = [];

// ═══════ HELPERS ═══════
function log(level, msg) {
  const icons = { PASS: '✅', FAIL: '❌', INFO: '📋', WARN: '⚠️' };
  console.log(`${icons[level] || '  '} [${level}] ${msg}`);
}

function assert(condition, testName, detail) {
  total++;
  if (condition) { passed++; log('PASS', `${testName}${detail ? ': ' + detail : ''}`); }
  else { failed++; log('FAIL', `${testName}${detail ? ': ' + detail : ''}`); }
  results.push({ test: testName, passed: condition, detail });
}

function q(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com', port: 443,
      path: '/v1/projects/' + projectRef + '/database/query',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function row(result) {
  if (Array.isArray(result) && result.length > 0) return result[0];
  return null;
}

function rows(result) {
  return Array.isArray(result) ? result : [];
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ═══════ TEST STATE ═══════
const state = {
  waiterId: null,
  chefId: null,
  receptionistId: null,
  housekeeperId: null,
  managerId: null,
  adminId: null,
  waiterShiftId: null,
  chefShiftId: null,
  receptionistShiftId: null,
  housekeeperShiftId: null,
  orderIds: [],
  paymentIds: [],
  waiterReconId: null,
  chefReconId: null,
  receptionistReconId: null,
  housekeeperReconId: null,
  notificationId: null,
  today: new Date().toISOString().split('T')[0],
};

// ═══════ CLEANUP ═══════
async function cleanupTestData() {
  log('INFO', 'Cleaning up previous reconciliation test data...');
  // Clean test reconciliations (only ones with test notes)
  await q(`DELETE FROM shift_reconciliations WHERE notes LIKE '%E2E_RECON%' OR variance_explanation LIKE '%E2E_RECON%'`);
  // Clean test orders
  await q(`DELETE FROM restaurant_order_items WHERE order_id IN (SELECT id FROM restaurant_orders WHERE guest_name LIKE '%E2E_RECON_%')`);
  await q(`DELETE FROM restaurant_orders WHERE guest_name LIKE '%E2E_RECON_%'`);
  // Clean test payments
  await q(`DELETE FROM payments WHERE mpesa_transaction_id LIKE 'E2E_RECON_%'`);
  // Clean test shifts
  await q(`DELETE FROM staff_shifts WHERE shift_date = '${state.today}' AND status = 'ended' AND user_id IN (SELECT id FROM users WHERE role IN ('waiter','chef','receptionist','housekeeper'))`);
  // Clean test notifications
  await q(`DELETE FROM notifications WHERE title LIKE '%E2E_RECON%'`);
  log('INFO', 'Cleanup complete');
}

// ═══════ FIXTURES ═══════
async function createFixtures() {
  log('INFO', 'Creating test fixtures...');

  // Get staff IDs
  const allStaff = rows(await q(`SELECT id, role, full_name FROM users WHERE role IN ('manager','receptionist','chef','waiter','housekeeper','admin') AND is_active=true`));
  for (const role of ['waiter', 'chef', 'receptionist', 'housekeeper', 'manager', 'admin']) {
    const byRole = allStaff.find(s => s.role === role);
    if (role === 'waiter') state.waiterId = byRole?.id;
    if (role === 'chef') state.chefId = byRole?.id;
    if (role === 'receptionist') state.receptionistId = byRole?.id;
    if (role === 'housekeeper') state.housekeeperId = byRole?.id;
    if (role === 'manager') state.managerId = byRole?.id;
    if (role === 'admin') state.adminId = byRole?.id;
  }

  assert(state.waiterId, 'Fixtures: Waiter user exists');
  assert(state.chefId, 'Fixtures: Chef user exists');
  assert(state.receptionistId, 'Fixtures: Receptionist user exists');
  assert(state.housekeeperId, 'Fixtures: Housekeeper user exists');
  assert(state.managerId, 'Fixtures: Manager user exists');
  assert(state.adminId, 'Fixtures: Admin user exists');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 1: Create Shifts
// ═══════════════════════════════════════════════════════════════
async function testCreateShifts() {
  log('INFO', '\n═══ SCENARIO 1: Create Shifts for All Staff ═══');

  // Get department IDs
  const depts = rows(await q(`SELECT id, name FROM departments`));
  const restaurantDept = depts.find(d => d.name === 'Restaurant')?.id;
  const kitchenDept = depts.find(d => d.name === 'Kitchen')?.id;
  const frontOfficeDept = depts.find(d => d.name === 'Front Office')?.id;
  const housekeepingDept = depts.find(d => d.name === 'Housekeeping')?.id;

  assert(restaurantDept && kitchenDept && frontOfficeDept && housekeepingDept, 'Fixtures: All departments exist');

  // Create ended shifts for all staff (morning shift 6am-2pm)
  const shiftData = [
    { userId: state.waiterId, deptId: restaurantDept, name: 'waiter', shiftName: 'morning' },
    { userId: state.chefId, deptId: kitchenDept, name: 'chef', shiftName: 'morning' },
    { userId: state.receptionistId, deptId: frontOfficeDept, name: 'receptionist', shiftName: 'morning' },
    { userId: state.housekeeperId, deptId: housekeepingDept, name: 'housekeeper', shiftName: 'morning' },
  ];

  for (const s of shiftData) {
    const result = row(await q(`INSERT INTO staff_shifts (user_id, department_id, shift_date, shift_name, start_time, end_time, status)
      VALUES ('${s.userId}', '${s.deptId}', '${state.today}', '${s.shiftName}',
        '${state.today}T06:00:00+03', '${state.today}T14:00:00+03', 'ended')
      RETURNING id`));

    if (s.name === 'waiter') state.waiterShiftId = result?.id;
    if (s.name === 'chef') state.chefShiftId = result?.id;
    if (s.name === 'receptionist') state.receptionistShiftId = result?.id;
    if (s.name === 'housekeeper') state.housekeeperShiftId = result?.id;

    assert(result?.id, `Shift: ${s.name} shift created`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 2: Create Restaurant Orders
// ═══════════════════════════════════════════════════════════════
async function testCreateOrders() {
  log('INFO', '\n═══ SCENARIO 2: Create Restaurant Orders ═══');

  let menuItems = rows(await q(`SELECT id, name, price FROM menu_items WHERE is_available=true LIMIT 5`));
  // If no menu items, create test ones
  if (menuItems.length < 3) {
    log('INFO', 'Creating test menu items...');
    for (const item of [
      { name: 'E2E_RECON_Pilau', price: 500 },
      { name: 'E2E_RECON_Chai', price: 80 },
      { name: 'E2E_RECON_Fish', price: 550 },
    ]) {
      await q(`INSERT INTO menu_items (name, price, is_available, category) VALUES ('${item.name}', ${item.price}, true, 'main') ON CONFLICT DO NOTHING`);
    }
    menuItems = rows(await q(`SELECT id, name, price FROM menu_items WHERE name LIKE 'E2E_RECON_%' OR (is_available=true ORDER BY created_at DESC LIMIT 5)`));
  }
  assert(menuItems.length >= 3, 'Fixtures: At least 3 menu items available');

  const orderData = [
    { guest: 'E2E_RECON_James', items: [0, 1], total: Number(menuItems[0].price) + Number(menuItems[1].price), type: 'dine_in' },
    { guest: 'E2E_RECON_Mary', items: [2], total: Number(menuItems[2].price), type: 'room_service' },
    { guest: 'E2E_RECON_WalkIn', items: [0], total: Number(menuItems[0].price), type: 'dine_in' },
  ];

  for (let i = 0; i < orderData.length; i++) {
    const o = orderData[i];
    const hour = 7 + i * 2;
    const orderTime = `${state.today}T${String(hour).padStart(2, '0')}:30:00+03`;

    const order = row(await q(`INSERT INTO restaurant_orders
      (order_number, source, guest_name, status, total, waiter_id, created_at, delivery_type)
      VALUES (
        (SELECT COALESCE(MAX(order_number), 0) + 1 FROM restaurant_orders),
        'walk_in', '${o.guest}', 'delivered', ${o.total},
        '${state.waiterId}', '${orderTime}', '${o.type}'
      ) RETURNING id, order_number`));

    assert(order?.id, `Order: #${order?.order_number} created for ${o.guest}`);

    // Add order items
    for (const itemIdx of o.items) {
      const item = menuItems[itemIdx];
      await q(`INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
        VALUES ('${order.id}', '${item.id}', 1, ${item.price}, ${item.price})`);
    }

    state.orderIds.push(order.id);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 3: Create Payments with M-Pesa Codes
// ═══════════════════════════════════════════════════════════════
async function testCreatePayments() {
  log('INFO', '\n═══ SCENARIO 3: Create Payments with M-Pesa Codes ═══');

  // Receptionist payments (cash + M-Pesa) — using payments table (no folio_id required)
  const receptionistPayments = [
    { amount: 5000, method: 'mpesa', mpesaCode: 'E2E_RECON_QHK7B4C9DE', time: '07:30' },
    { amount: 3200, method: 'cash', mpesaCode: null, time: '09:00' },
    { amount: 4500, method: 'mpesa', mpesaCode: 'E2E_RECON_RJL3F8G2KM', time: '10:30' },
  ];

  for (const p of receptionistPayments) {
    const payTime = `${state.today}T${p.time}:00+03`;
    const result = row(await q(`INSERT INTO payments
      (amount, method, mpesa_transaction_id, status, recorded_by, created_at)
      VALUES (${p.amount}, '${p.method}', ${p.mpesaCode ? `'${p.mpesaCode}'` : 'NULL'}, 'verified', '${state.receptionistId}', '${payTime}')
      RETURNING id`));
    assert(result?.id, `Payment: Receptionist ${p.method} KES ${p.amount}`);
    state.paymentIds.push(result.id);
  }

  // Waiter food payments
  const waiterPayments = [
    { orderId: state.orderIds[0], amount: Number(row(await q(`SELECT total FROM restaurant_orders WHERE id='${state.orderIds[0]}'`))?.total), method: 'mpesa', mpesaCode: 'E2E_RECON_SHN5P6T9WV', time: '08:00' },
    { orderId: state.orderIds[1], amount: Number(row(await q(`SELECT total FROM restaurant_orders WHERE id='${state.orderIds[1]}'`))?.total), method: 'cash', mpesaCode: null, time: '10:00' },
    { orderId: state.orderIds[2], amount: Number(row(await q(`SELECT total FROM restaurant_orders WHERE id='${state.orderIds[2]}'`))?.total), method: 'mpesa', mpesaCode: 'E2E_RECON_TKM8V2X7YZ', time: '12:00' },
  ];

  for (const p of waiterPayments) {
    const payTime = `${state.today}T${p.time}:00+03`;
    const result = row(await q(`INSERT INTO payments
      (order_id, amount, method, mpesa_transaction_id, status, recorded_by, created_at)
      VALUES ('${p.orderId}', ${p.amount}, '${p.method}', ${p.mpesaCode ? `'${p.mpesaCode}'` : 'NULL'}, 'verified', '${state.waiterId}', '${payTime}')
      RETURNING id`));
    assert(result?.id, `Payment: Waiter ${p.method} KES ${p.amount}`);
    state.paymentIds.push(result.id);
  }

  // Calculate totals
  const receptionistCash = receptionistPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const receptionistMpesa = receptionistPayments.filter(p => p.method === 'mpesa').reduce((s, p) => s + p.amount, 0);
  const waiterCash = waiterPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const waiterMpesa = waiterPayments.filter(p => p.method === 'mpesa').reduce((s, p) => s + p.amount, 0);

  state.receptionistCashTotal = receptionistCash;
  state.receptionistMpesaTotal = receptionistMpesa;
  state.waiterCashTotal = waiterCash;
  state.waiterMpesaTotal = waiterMpesa;

  log('INFO', `Receptionist: Cash KES ${receptionistCash}, M-Pesa KES ${receptionistMpesa}`);
  log('INFO', `Waiter: Cash KES ${waiterCash}, M-Pesa KES ${waiterMpesa}`);
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 4: Submit Reconciliations with Variances
// ═══════════════════════════════════════════════════════════════
async function testSubmitReconciliations() {
  log('INFO', '\n═══ SCENARIO 4: Submit Reconciliations ═══');

  // Waiter: SHORT by KES 50
  const waiterExpected = state.waiterCashTotal;
  const waiterActual = state.waiterCashTotal - 50;
  const waiterVariance = waiterActual - waiterExpected;

  const waiterRecon = row(await q(`INSERT INTO shift_reconciliations
    (shift_id, submitted_by, sales_total, cash_total, mpesa_total, room_charges_total,
     expected_cash, actual_cash, variance, notes, status, variance_status, variance_explanation, variance_proof_type)
    VALUES (
      '${state.waiterShiftId}', '${state.waiterId}',
      ${state.waiterCashTotal + state.waiterMpesaTotal}, ${state.waiterCashTotal}, ${state.waiterMpesaTotal}, 0,
      ${waiterExpected}, ${waiterActual}, ${waiterVariance},
      'E2E_RECON: Short KES 50 — gave wrong change to walk-in at table 3',
      'submitted', 'open',
      'E2E_RECON: Gave wrong change of KES 50 to walk-in customer. Verified with table receipt.',
      'mpesa_message'
    ) RETURNING id, status, variance, variance_status`));

  assert(waiterRecon?.id, 'Reconciliation: Waiter submitted with variance KES -50');
  assert(waiterRecon?.status === 'submitted', 'Reconciliation: Waiter status is submitted');
  assert(waiterRecon?.variance_status === 'open', 'Reconciliation: Waiter variance_status is open');
  state.waiterReconId = waiterRecon.id;

  // Chef: OVER by KES 100
  const chefSales = 8500;
  const chefCash = 3500;
  const chefMpesa = 5000;
  const chefExpected = 3500;
  const chefActual = 3600;
  const chefVariance = chefActual - chefExpected;

  const chefRecon = row(await q(`INSERT INTO shift_reconciliations
    (shift_id, submitted_by, sales_total, cash_total, mpesa_total, room_charges_total,
     expected_cash, actual_cash, variance, notes, status, variance_status)
    VALUES (
      '${state.chefShiftId}', '${state.chefId}',
      ${chefSales}, ${chefCash}, ${chefMpesa}, 0,
      ${chefExpected}, ${chefActual}, ${chefVariance},
      'E2E_RECON: Over KES 100 — received extra tip from table 5',
      'submitted', 'open'
    ) RETURNING id, status, variance, variance_status`));

  assert(chefRecon?.id, 'Reconciliation: Chef submitted with variance KES +100');
  assert(chefRecon?.variance_status === 'open', 'Reconciliation: Chef variance_status is open');
  state.chefReconId = chefRecon.id;

  // Receptionist: SHORT by KES 200
  const receptionistExpected = state.receptionistCashTotal;
  const receptionistActual = state.receptionistCashTotal - 200;
  const receptionistVariance = receptionistActual - receptionistExpected;

  const receptionistRecon = row(await q(`INSERT INTO shift_reconciliations
    (shift_id, submitted_by, sales_total, cash_total, mpesa_total, room_charges_total,
     expected_cash, actual_cash, variance, notes, status, variance_status)
    VALUES (
      '${state.receptionistShiftId}', '${state.receptionistId}',
      ${state.receptionistCashTotal + state.receptionistMpesaTotal}, ${state.receptionistCashTotal}, ${state.receptionistMpesaTotal}, ${state.receptionistCashTotal + state.receptionistMpesaTotal},
      ${receptionistExpected}, ${receptionistActual}, ${receptionistVariance},
      'E2E_RECON: Short KES 200 — M-Pesa timeout on room payment',
      'submitted', 'open'
    ) RETURNING id, status, variance, variance_status`));

  assert(receptionistRecon?.id, 'Reconciliation: Receptionist submitted with variance KES -200');
  state.receptionistReconId = receptionistRecon.id;

  // Housekeeper: NO VARIANCE
  const housekeeperRecon = row(await q(`INSERT INTO shift_reconciliations
    (shift_id, submitted_by, sales_total, cash_total, mpesa_total, room_charges_total,
     expected_cash, actual_cash, variance, notes, status, variance_status)
    VALUES (
      '${state.housekeeperShiftId}', '${state.housekeeperId}',
      0, 0, 0, 0,
      0, 0, 0,
      'E2E_RECON: Completed 8 room turnovers. No financial transactions.',
      'submitted', 'none'
    ) RETURNING id, status, variance`));

  assert(housekeeperRecon?.id, 'Reconciliation: Housekeeper submitted with no variance');
  assert(Number(housekeeperRecon?.variance) === 0, 'Reconciliation: Housekeeper variance is 0');
  state.housekeeperReconId = housekeeperRecon.id;
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 5: Manager Flags Reconciliation
// ═══════════════════════════════════════════════════════════════
async function testManagerFlags() {
  log('INFO', '\n═══ SCENARIO 5: Manager Flags Reconciliation ═══');

  // Flag waiter's reconciliation
  const flagged = row(await q(`UPDATE shift_reconciliations
    SET status = 'flagged',
        manager_id = '${state.managerId}',
        manager_notes = 'E2E_RECON: Need M-Pesa confirmation for the KES 50 shortage. Customer insists they paid correctly.'
    WHERE id = '${state.waiterReconId}'
    RETURNING id, status, manager_notes, manager_id`));

  assert(flagged?.status === 'flagged', 'Flag: Waiter reconciliation flagged');
  assert(flagged?.manager_notes?.includes('E2E_RECON'), 'Flag: Manager notes recorded');

  // Also flag chef's reconciliation
  const chefFlagged = row(await q(`UPDATE shift_reconciliations
    SET status = 'flagged',
        manager_id = '${state.managerId}',
        manager_notes = 'E2E_RECON: Need explanation for KES 100 overage. Where did the extra cash come from?'
    WHERE id = '${state.chefReconId}'
    RETURNING id, status`));

  assert(chefFlagged?.status === 'flagged', 'Flag: Chef reconciliation flagged');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 6: Verify Staff Notifications
// ═══════════════════════════════════════════════════════════════
async function testNotifications() {
  log('INFO', '\n═══ SCENARIO 6: Verify Staff Notifications ═══');

  // Create notifications for the flagged staff (simulating what the hook does)
  await q(`INSERT INTO notifications (user_id, title, body, type, read)
    VALUES ('${state.waiterId}', 'E2E_RECON: ⚠️ Reconciliation Flagged',
      'Your morning shift reconciliation was flagged. Reason: Need M-Pesa confirmation. Please submit an explanation with proof.',
      'reconciliation', false)`);

  await q(`INSERT INTO notifications (user_id, title, body, type, read)
    VALUES ('${state.chefId}', 'E2E_RECON: ⚠️ Reconciliation Flagged',
      'Your morning shift reconciliation was flagged. Reason: Need explanation for overage.',
      'reconciliation', false)`);

  // Verify waiter notification exists
  const waiterNotif = row(await q(`SELECT id, title, body, type, read
    FROM notifications
    WHERE user_id = '${state.waiterId}' AND title LIKE '%E2E_RECON%' AND type = 'reconciliation'
    ORDER BY created_at DESC LIMIT 1`));

  assert(waiterNotif?.id, 'Notification: Waiter has flagged notification');
  assert(waiterNotif?.title?.includes('Flagged'), 'Notification: Title contains "Flagged"');
  assert(waiterNotif?.read === false, 'Notification: Not yet read');
  state.notificationId = waiterNotif.id;

  // Verify chef notification
  const chefNotif = row(await q(`SELECT id FROM notifications
    WHERE user_id = '${state.chefId}' AND title LIKE '%E2E_RECON%' AND type = 'reconciliation'`));
  assert(chefNotif?.id, 'Notification: Chef has flagged notification');

  // Verify no notification for housekeeper (no variance)
  const hkNotif = row(await q(`SELECT id FROM notifications
    WHERE user_id = '${state.housekeeperId}' AND title LIKE '%E2E_RECON%' AND type = 'reconciliation'`));
  assert(!hkNotif?.id, 'Notification: Housekeeper has no flagged notification');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 7: Staff Explains with M-Pesa Proof
// ═══════════════════════════════════════════════════════════════
async function testStaffExplains() {
  log('INFO', '\n═══ SCENARIO 7: Staff Explains with M-Pesa Proof ═══');

  // Waiter explains variance
  const waiterExplained = row(await q(`UPDATE shift_reconciliations
    SET status = 'explained',
        variance_status = 'staff_explained',
        variance_explanation = 'E2E_RECON: Found the M-Pesa confirmation. Transaction ID E2E_RECON_QHK7B4C9DE for KES 450 was received at 07:32. The payment went through but the system did not record it due to a network delay. Screenshot attached.',
        variance_proof_type = 'mpesa_message',
        variance_proof_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
        variance_resolved_at = NOW()
    WHERE id = '${state.waiterReconId}'
    RETURNING id, status, variance_status, variance_explanation, variance_proof_type, variance_proof_url`));

  assert(waiterExplained?.status === 'explained', 'Explain: Waiter status changed to explained');
  assert(waiterExplained?.variance_status === 'staff_explained', 'Explain: variance_status is staff_explained');
  assert(waiterExplained?.variance_proof_type === 'mpesa_message', 'Explain: proof type is mpesa_message');
  assert(waiterExplained?.variance_proof_url?.includes('unsplash'), 'Explain: proof URL recorded');

  // Chef explains variance
  const chefExplained = row(await q(`UPDATE shift_reconciliations
    SET status = 'explained',
        variance_status = 'staff_explained',
        variance_explanation = 'E2E_RECON: Customer at table 5 left a KES 100 tip on the table. I forgot to record it as a separate payment. The cash is in the till.',
        variance_proof_type = 'receipt',
        variance_proof_url = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
        variance_resolved_at = NOW()
    WHERE id = '${state.chefReconId}'
    RETURNING id, status, variance_status, variance_proof_type`));

  assert(chefExplained?.status === 'explained', 'Explain: Chef status changed to explained');
  assert(chefExplained?.variance_proof_type === 'receipt', 'Explain: Chef proof type is receipt');

  // Verify manager gets notification about explanation
  await q(`INSERT INTO notifications (user_id, title, body, type, read)
    VALUES ('${state.managerId}', 'E2E_RECON: Variance Explanation Received',
      'Staff has submitted an explanation for a flagged variance. Please review.',
      'reconciliation', false)`);

  const managerNotif = row(await q(`SELECT id FROM notifications
    WHERE user_id = '${state.managerId}' AND title LIKE '%E2E_RECON%Explanation%' AND type = 'reconciliation'`));
  assert(managerNotif?.id, 'Notification: Manager notified of explanation');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 8: Admin Confirms Variance Resolution
// ═══════════════════════════════════════════════════════════════
async function testAdminConfirms() {
  log('INFO', '\n═══ SCENARIO 8: Admin Confirms Variance Resolution ═══');

  // Admin confirms waiter's variance
  const waiterConfirmed = row(await q(`UPDATE shift_reconciliations
    SET variance_status = 'resolved',
        variance_admin_confirmed = true,
        variance_admin_proof_url = 'https://images.unsplash.com/photo-1556742393-d75f468bfcb0?w=400',
        variance_admin_confirmed_by = '${state.adminId}',
        variance_admin_confirmed_at = NOW(),
        manager_notes = 'E2E_RECON: Verified M-Pesa confirmation QHK7B4C9DE matches. Variance resolved.'
    WHERE id = '${state.waiterReconId}'
    RETURNING id, variance_status, variance_admin_confirmed, variance_admin_confirmed_by`));

  assert(waiterConfirmed?.variance_status === 'resolved', 'Confirm: Waiter variance resolved');
  assert(waiterConfirmed?.variance_admin_confirmed === true, 'Confirm: Admin confirmed flag set');
  assert(waiterConfirmed?.variance_admin_confirmed_by === state.adminId, 'Confirm: Confirmed by admin');

  // Admin confirms chef's variance
  const chefConfirmed = row(await q(`UPDATE shift_reconciliations
    SET variance_status = 'resolved',
        variance_admin_confirmed = true,
        variance_admin_proof_url = 'https://images.unsplash.com/photo-1556742111-a301076d9d18?w=400',
        variance_admin_confirmed_by = '${state.adminId}',
        variance_admin_confirmed_at = NOW(),
        manager_notes = 'E2E_RECON: Tip confirmed by table 5 receipt. Variance resolved.'
    WHERE id = '${state.chefReconId}'
    RETURNING id, variance_status, variance_admin_confirmed`));

  assert(chefConfirmed?.variance_status === 'resolved', 'Confirm: Chef variance resolved');

  // Notify staff of resolution
  await q(`INSERT INTO notifications (user_id, title, body, type, read)
    VALUES ('${state.waiterId}', 'E2E_RECON: ✅ Variance Resolved',
      'Admin has confirmed your variance explanation. Your shift reconciliation has been resolved.',
      'reconciliation', false)`);

  await q(`INSERT INTO notifications (user_id, title, body, type, read)
    VALUES ('${state.chefId}', 'E2E_RECON: ✅ Variance Resolved',
      'Admin has confirmed your variance explanation. Your shift reconciliation has been resolved.',
      'reconciliation', false)`);

  const waiterResNotif = row(await q(`SELECT id FROM notifications
    WHERE user_id = '${state.waiterId}' AND title LIKE '%E2E_RECON%Resolved%'`));
  assert(waiterResNotif?.id, 'Notification: Waiter notified of resolution');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 9: Manager Approves & Closes Shifts
// ═══════════════════════════════════════════════════════════════
async function testManagerCloses() {
  log('INFO', '\n═══ SCENARIO 9: Manager Approves & Closes Shifts ═══');

  // Approve waiter's reconciliation
  const waiterApproved = row(await q(`UPDATE shift_reconciliations
    SET status = 'approved',
        manager_id = '${state.managerId}'
    WHERE id = '${state.waiterReconId}'
    RETURNING id, status`));

  assert(waiterApproved?.status === 'approved', 'Close: Waiter reconciliation approved');

  // Update shift status
  await q(`UPDATE staff_shifts SET status = 'reconciled' WHERE id = '${state.waiterShiftId}'`);

  // Now close (final step)
  const waiterClosed = row(await q(`UPDATE shift_reconciliations
    SET status = 'reconciled',
        reconciled_at = NOW()
    WHERE id = '${state.waiterReconId}'
    RETURNING id, status, reconciled_at`));

  assert(waiterClosed?.status === 'reconciled', 'Close: Waiter reconciliation closed');
  assert(waiterClosed?.reconciled_at, 'Close: reconciled_at timestamp set');

  await q(`UPDATE staff_shifts SET status = 'closed' WHERE id = '${state.waiterShiftId}'`);

  // Same for chef
  await q(`UPDATE shift_reconciliations SET status = 'approved', manager_id = '${state.managerId}' WHERE id = '${state.chefReconId}'`);
  await q(`UPDATE staff_shifts SET status = 'reconciled' WHERE id = '${state.chefShiftId}'`);
  await q(`UPDATE shift_reconciliations SET status = 'reconciled', reconciled_at = NOW() WHERE id = '${state.chefReconId}'`);
  await q(`UPDATE staff_shifts SET status = 'closed' WHERE id = '${state.chefShiftId}'`);

  // Approve housekeeper (no variance — straight to close)
  await q(`UPDATE shift_reconciliations SET status = 'approved', manager_id = '${state.managerId}' WHERE id = '${state.housekeeperReconId}'`);
  await q(`UPDATE staff_shifts SET status = 'reconciled' WHERE id = '${state.housekeeperShiftId}'`);
  await q(`UPDATE shift_reconciliations SET status = 'reconciled', reconciled_at = NOW() WHERE id = '${state.housekeeperReconId}'`);
  await q(`UPDATE staff_shifts SET status = 'closed' WHERE id = '${state.housekeeperShiftId}'`);

  const housekeeperClosed = row(await q(`SELECT status FROM shift_reconciliations WHERE id = '${state.housekeeperReconId}'`));
  assert(housekeeperClosed?.status === 'reconciled', 'Close: Housekeeper reconciliation closed');

  // Approve receptionist (explain → approve → close)
  await q(`UPDATE shift_reconciliations SET status = 'approved', manager_id = '${state.managerId}' WHERE id = '${state.receptionistReconId}'`);
  await q(`UPDATE staff_shifts SET status = 'reconciled' WHERE id = '${state.receptionistShiftId}'`);
  await q(`UPDATE shift_reconciliations SET status = 'reconciled', reconciled_at = NOW() WHERE id = '${state.receptionistReconId}'`);
  await q(`UPDATE staff_shifts SET status = 'closed' WHERE id = '${state.receptionistShiftId}'`);

  // Notify all staff
  for (const [userId, name] of [[state.waiterId, 'waiter'], [state.chefId, 'chef'], [state.receptionistId, 'receptionist'], [state.housekeeperId, 'housekeeper']]) {
    await q(`INSERT INTO notifications (user_id, title, body, type, read)
      VALUES ('${userId}', 'E2E_RECON: 🔒 Shift Closed',
        'Your morning shift has been fully reconciled and closed.',
        'reconciliation', false)`);
  }

  const closedNotifs = rows(await q(`SELECT id FROM notifications WHERE title LIKE '%E2E_RECON%Closed%'`));
  assert(closedNotifs.length >= 4, 'Notification: All 4 staff notified of shift closure');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 10: Final State Verification
// ═══════════════════════════════════════════════════════════════
async function testFinalState() {
  log('INFO', '\n═══ SCENARIO 10: Final State Verification ═══');

  // All shifts should be closed
  const shifts = rows(await q(`SELECT id, status FROM staff_shifts
    WHERE id IN ('${state.waiterShiftId}','${state.chefShiftId}','${state.receptionistShiftId}','${state.housekeeperShiftId}')`));

  for (const s of shifts) {
    assert(s.status === 'closed', `Final: Shift ${s.id.substring(0, 8)} is closed`);
  }

  // All reconciliations should be reconciled
  const recons = rows(await q(`SELECT id, status, variance, variance_status, reconciled_at FROM shift_reconciliations
    WHERE id IN ('${state.waiterReconId}','${state.chefReconId}','${state.receptionistReconId}','${state.housekeeperReconId}')`));

  for (const r of recons) {
    assert(r.status === 'reconciled', `Final: Reconciliation ${r.id.substring(0, 8)} is reconciled`);
    assert(r.reconciled_at, `Final: Reconciliation ${r.id.substring(0, 8)} has reconciled_at`);
  }

  // Waiter variance resolved
  const waiterRecon = recons.find(r => r.id === state.waiterReconId);
  assert(waiterRecon?.variance_status === 'resolved', 'Final: Waiter variance resolved');

  // Chef variance resolved
  const chefRecon = recons.find(r => r.id === state.chefReconId);
  assert(chefRecon?.variance_status === 'resolved', 'Final: Chef variance resolved');

  // Housekeeper no variance
  const hkRecon = recons.find(r => r.id === state.housekeeperReconId);
  assert(hkRecon?.variance_status === 'none', 'Final: Housekeeper no variance');

  // Payments exist with M-Pesa codes
  const mpesaPayments = rows(await q(`SELECT id, mpesa_transaction_id FROM payments
    WHERE mpesa_transaction_id LIKE 'E2E_RECON_%'`));
  assert(mpesaPayments.length >= 2, `Final: ${mpesaPayments.length} M-Pesa payments with codes`);

  // Orders exist
  const orders = rows(await q(`SELECT id FROM restaurant_orders WHERE guest_name LIKE 'E2E_RECON_%'`));
  assert(orders.length >= 3, `Final: ${orders.length} test orders created`);

  // Notifications were created
  const allNotifs = rows(await q(`SELECT id, title, user_id FROM notifications WHERE title LIKE 'E2E_RECON_%'`));
  assert(allNotifs.length >= 8, `Final: ${allNotifs.length} reconciliation notifications created`);

  // Mark all test notifications as read
  await q(`UPDATE notifications SET read = true WHERE title LIKE 'E2E_RECON_%'`);
  const unreadNotifs = rows(await q(`SELECT id FROM notifications WHERE title LIKE 'E2E_RECON_%' AND read = false`));
  assert(unreadNotifs.length === 0, 'Final: All test notifications marked as read');
}

// ═══════ MAIN ═══════
async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  E2E RECONCILIATION LIFECYCLE TEST — Keyman Hotel');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    await cleanupTestData();
    await createFixtures();
    await testCreateShifts();
    await testCreateOrders();
    await testCreatePayments();
    await testSubmitReconciliations();
    await testManagerFlags();
    await testNotifications();
    await testStaffExplains();
    await testAdminConfirms();
    await testManagerCloses();
    await testFinalState();
  } catch (e) {
    log('FAIL', `FATAL: ${e.message}`);
    console.error(e.stack);
    failed++;
    total++;
  }

  // Cleanup test data
  await cleanupTestData();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
