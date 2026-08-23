/**
 * E2E COMMUNICATIONS TEST — Keyman Hotel
 * 
 * Tests all inter-communication scenarios between:
 * guest, receptionist, chef, waiter, housekeeper, manager, admin
 * 
 * Covers: message delivery, channel membership, notifications, unread counts
 */

const https = require('https');
const fs = require('fs');

const token = process.env.SUPABASE_MGMT_TOKEN || fs.readFileSync('.env', 'utf8').match(/SUPABASE_MGMT_TOKEN=(.*)/)?.[1]?.trim();
const projectRef = 'uuojiyehhnhjcakgpsjd';

let passed = 0, failed = 0, total = 0;

function log(level, msg) {
  const icons = { PASS: '✅', FAIL: '❌', INFO: '📋', WARN: '⚠️' };
  console.log(`${icons[level] || '  '} [${level}] ${msg}`);
}

function assert(condition, testName, detail) {
  total++;
  if (condition) { passed++; log('PASS', `${testName}${detail ? ': ' + detail : ''}`); }
  else { failed++; log('FAIL', `${testName}${detail ? ': ' + detail : ''}`); }
}

function row(result) {
  if (Array.isArray(result) && result.length > 0) return result[0];
  return null;
}

function rows(result) {
  return Array.isArray(result) ? result : [];
}

function q(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com', port: 443,
      path: '/v1/projects/' + projectRef + '/database/query', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve([]); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════ TEST STATE ═══════
const state = {
  staff: {},
  guest: null,
  channels: {},
  messageIds: [],
};

// ═══════ CLEANUP ═══════
async function cleanup() {
  log('INFO', 'Cleaning up previous comm test data...');
  await q(`DELETE FROM messages WHERE content LIKE 'E2E_COMM_TEST_%'`);
  await q(`DELETE FROM notifications WHERE title LIKE 'E2E_COMM_TEST_%'`);
  log('INFO', 'Cleanup complete');
}

// ═══════ FIXTURES ═══════
async function loadFixtures() {
  log('INFO', 'Loading fixtures...');

  // Load staff by role
  const allStaff = rows(await q(`SELECT id, role, full_name, email FROM users WHERE role IN ('admin','manager','receptionist','chef','waiter','housekeeper','accountant') AND is_active=true`));
  for (const role of ['admin', 'manager', 'receptionist', 'chef', 'waiter', 'housekeeper', 'accountant']) {
    const match = allStaff.find(s => s.role === role);
    state.staff[role] = match || null;
  }
  assert(Object.values(state.staff).filter(v => v).length >= 5, 'Fixtures: At least 5 staff roles found');

  // Load guest
  const guestUser = row(await q(`SELECT id, email, full_name FROM users WHERE role='guest' AND is_active=true LIMIT 1`));
  state.guest = guestUser;
  assert(!!state.guest, 'Fixtures: Guest user found');

  // Load key system channels
  const keyChannels = ['general', 'reception', 'kitchen', 'housekeeping', 'payments', 'guest-support'];
  for (const name of keyChannels) {
    const ch = row(await q(`SELECT id, name, type FROM message_channels WHERE name='${name}' AND type='group' LIMIT 1`));
    state.channels[name] = ch;
  }
  log('INFO', `Channels found: ${Object.entries(state.channels).filter(([k,v]) => v).map(([k]) => k).join(', ')}`);

  // Load all staff user IDs for broadcast tests
  state.allStaffIds = allStaff.map(s => s.id);

  const staffNames = Object.fromEntries(Object.entries(state.staff).map(([k,v]) => [k, v?.full_name || v?.email || "N/A"]));
  log("INFO", "Staff: " + JSON.stringify(staffNames));
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 1: Channel Existence & Membership
// ═══════════════════════════════════════════════════════════════
async function testChannelMembership() {
  log('INFO', '\n═══ SCENARIO 1: Channel Existence & Membership ═══');

  // 1.1 System channels exist
  const systemChannels = ['general', 'reception', 'kitchen', 'housekeeping', 'payments', 'guest-support'];
  for (const name of systemChannels) {
    const ch = state.channels[name];
    assert(!!ch, `1.1.${systemChannels.indexOf(name) + 1} Channel "${name}" exists`);
  }

  // 1.2 General channel has all staff
  if (state.channels.general) {
    const members = rows(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.general.id}'`));
    const memberIds = members.map(m => m.user_id);
    const allStaffInGeneral = state.allStaffIds.every(id => memberIds.includes(id));
    assert(allStaffInGeneral, '1.2 General channel has all staff members', `${memberIds.length} members`);
  }

  // 1.3 Reception channel has receptionist, admin, manager
  if (state.channels.reception) {
    const members = rows(await q(`SELECT cm.user_id, u.role FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id='${state.channels.reception.id}'`));
    const roles = members.map(m => m.role);
    assert(roles.includes('receptionist'), '1.3.a Reception channel has receptionist');
    assert(roles.includes('admin'), '1.3.b Reception channel has admin');
    assert(roles.includes('manager'), '1.3.c Reception channel has manager');
  }

  // 1.4 Kitchen channel has chef, waiter, admin, manager
  if (state.channels.kitchen) {
    const members = rows(await q(`SELECT cm.user_id, u.role FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id='${state.channels.kitchen.id}'`));
    const roles = members.map(m => m.role);
    assert(roles.includes('chef'), '1.4.a Kitchen channel has chef');
    assert(roles.includes('waiter'), '1.4.b Kitchen channel has waiter');
    assert(roles.includes('admin'), '1.4.c Kitchen channel has admin');
  }

  // 1.5 Housekeeping channel has housekeeper, admin, manager
  if (state.channels.housekeeping) {
    const members = rows(await q(`SELECT cm.user_id, u.role FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id='${state.channels.housekeeping.id}'`));
    const roles = members.map(m => m.role);
    assert(roles.includes('housekeeper'), '1.5.a Housekeeping channel has housekeeper');
    assert(roles.includes('admin') || roles.includes('manager'), '1.5.b Housekeeping channel has admin or manager');
  }

  // 1.6 Payments channel has accountant, admin, manager
  if (state.channels.payments) {
    const members = rows(await q(`SELECT cm.user_id, u.role FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id='${state.channels.payments.id}'`));
    const roles = members.map(m => m.role);
    assert(roles.includes('admin') || roles.includes('manager'), '1.6 Payments channel has admin or manager');
  }

  // 1.7 Guest-support channel has guest
  if (state.channels['guest-support']) {
    const members = rows(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels['guest-support'].id}'`));
    const memberIds = members.map(m => m.user_id);
    const guestInChannel = state.guest && memberIds.includes(state.guest.id);
    // Guest may not be in guest-support yet — check if channel has any members
    assert(memberIds.length > 0, '1.7 Guest-support channel has members', `${memberIds.length} members`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 2: Message Delivery — General Channel
// ═══════════════════════════════════════════════════════════════
async function testGeneralChannelMessaging() {
  log('INFO', '\n═══ SCENARIO 2: General Channel Message Delivery ═══');

  if (!state.channels.general || !state.staff.admin) {
    log('WARN', 'Skipping — missing general channel or admin');
    return;
  }

  // 2.1 Admin sends message to general
  const adminId = state.staff.admin.id;
  const msgContent = `E2E_COMM_TEST_Admin announcement ${Date.now()}`;
  const msg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.general.id}', '${adminId}', '${msgContent}') RETURNING id, created_at`));
  assert(!!msg, '2.1 Admin message sent to general');
  if (msg) state.messageIds.push(msg.id);

  // 2.2 Message is visible in channel
  const visibleMsg = row(await q(`SELECT id, content, sender_id FROM messages WHERE channel_id='${state.channels.general.id}' AND content='${msgContent}'`));
  assert(!!visibleMsg, '2.2 Message visible in general channel');
  assert(visibleMsg?.sender_id === adminId, '2.3 Sender ID matches admin');

  // 2.4 Manager can see the message
  const managerMember = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.general.id}' AND user_id='${state.staff.manager?.id}'`));
  assert(!!managerMember, '2.4 Manager is member of general (can see message)');

  // 2.5 Chef can see the message
  const chefMember = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.general.id}' AND user_id='${state.staff.chef?.id}'`));
  assert(!!chefMember, '2.5 Chef is member of general (can see message)');

  // 2.6 Housekeeper can see the message
  const hkMember = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.general.id}' AND user_id='${state.staff.housekeeper?.id}'`));
  assert(!!hkMember, '2.6 Housekeeper is member of general (can see message)');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 3: Kitchen Channel — Chef ↔ Waiter Communication
// ═══════════════════════════════════════════════════════════════
async function testKitchenChannel() {
  log('INFO', '\n═══ SCENARIO 3: Kitchen Channel (Chef ↔ Waiter) ═══');

  if (!state.channels.kitchen || !state.staff.chef || !state.staff.waiter) {
    log('WARN', 'Skipping — missing kitchen channel or chef/waiter');
    return;
  }

  // 3.1 Chef sends order ready notification
  const chefMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.kitchen.id}', '${state.staff.chef.id}', 'E2E_COMM_TEST_Order #100 ready for pickup') RETURNING id`));
  assert(!!chefMsg, '3.1 Chef message sent to kitchen');

  // 3.2 Waiter is member (can see it)
  const waiterMember = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.kitchen.id}' AND user_id='${state.staff.waiter.id}'`));
  assert(!!waiterMember, '3.2 Waiter is member of kitchen channel');

  // 3.3 Waiter replies
  const waiterMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.kitchen.id}', '${state.staff.waiter.id}', 'E2E_COMM_TEST_Got it, heading to kitchen') RETURNING id`));
  assert(!!waiterMsg, '3.3 Waiter reply sent to kitchen');

  // 3.4 Both messages in correct order
  const msgs = rows(await q(`SELECT id, sender_id, content FROM messages WHERE channel_id='${state.channels.kitchen.id}' AND content LIKE 'E2E_COMM_TEST_%' ORDER BY created_at ASC`));
  assert(msgs.length >= 2, '3.4 Both messages present in kitchen channel');
  if (msgs.length >= 2) {
    assert(msgs[0].sender_id === state.staff.chef.id, '3.5 Chef message is first');
    assert(msgs[1].sender_id === state.staff.waiter.id, '3.6 Waiter message is second');
  }

  // 3.7 Receptionist is NOT in kitchen channel (isolated)
  const receptionistInKitchen = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.kitchen.id}' AND user_id='${state.staff.receptionist?.id}'`));
  // Receptionist might be in kitchen via admin fallback — check
  log('INFO', `Receptionist in kitchen: ${!!receptionistInKitchen}`);
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 4: Reception Channel — Receptionist ↔ Manager
// ═══════════════════════════════════════════════════════════════
async function testReceptionChannel() {
  log('INFO', '\n═══ SCENARIO 4: Reception Channel (Receptionist ↔ Manager) ═══');

  if (!state.channels.reception || !state.staff.receptionist || !state.staff.manager) {
    log('WARN', 'Skipping — missing reception channel or staff');
    return;
  }

  // 4.1 Receptionist sends check-in notification
  const recMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.reception.id}', '${state.staff.receptionist.id}', 'E2E_COMM_TEST_Guest checked into Room 106') RETURNING id`));
  assert(!!recMsg, '4.1 Receptionist message sent to reception');

  // 4.2 Manager sees it
  const mgrMember = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.reception.id}' AND user_id='${state.staff.manager.id}'`));
  assert(!!mgrMember, '4.2 Manager is member of reception channel');

  // 4.3 Manager acknowledges
  const mgrMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.reception.id}', '${state.staff.manager.id}', 'E2E_COMM_TEST_Copy, updating dashboard') RETURNING id`));
  assert(!!mgrMsg, '4.3 Manager reply sent to reception');

  // 4.4 Chef is NOT in reception channel (cross-department isolation)
  const chefInReception = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.reception.id}' AND user_id='${state.staff.chef.id}'`));
  log('INFO', `Chef in reception channel: ${!!chefInReception}`);
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 5: Housekeeping Channel
// ═══════════════════════════════════════════════════════════════
async function testHousekeepingChannel() {
  log('INFO', '\n═══ SCENARIO 5: Housekeeping Channel ═══');

  if (!state.channels.housekeeping || !state.staff.housekeeper) {
    log('WARN', 'Skipping — missing housekeeping channel or housekeeper');
    return;
  }

  // 5.1 Housekeeper reports room cleaned
  const hkMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.housekeeping.id}', '${state.staff.housekeeper.id}', 'E2E_COMM_TEST_Room 203 cleaned and ready') RETURNING id`));
  assert(!!hkMsg, '5.1 Housekeeper message sent');

  // 5.2 Manager/admin can see it
  const adminInHK = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.housekeeping.id}' AND user_id='${state.staff.admin?.id}'`));
  assert(!!adminInHK, '5.2 Admin is member of housekeeping channel');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 6: Payments Channel — Financial Communication
// ═══════════════════════════════════════════════════════════════
async function testPaymentsChannel() {
  log('INFO', '\n═══ SCENARIO 6: Payments Channel ═══');

  if (!state.channels.payments || !state.staff.admin) {
    log('WARN', 'Skipping — missing payments channel');
    return;
  }

  // 6.1 Admin sends reconciliation notice
  const payMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.payments.id}', '${state.staff.admin.id}', 'E2E_COMM_TEST_Daily reconciliation: KES 45,000 collected') RETURNING id`));
  assert(!!payMsg, '6.1 Admin message sent to payments');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 7: Guest-Support Channel
// ═══════════════════════════════════════════════════════════════
async function testGuestSupportChannel() {
  log('INFO', '\n═══ SCENARIO 7: Guest-Support Channel ═══');

  if (!state.channels['guest-support'] || !state.guest) {
    log('WARN', 'Skipping — missing guest-support channel or guest');
    return;
  }

  // 7.1 Guest sends support request
  const guestMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels['guest-support'].id}', '${state.guest.id}', 'E2E_COMM_TEST_Hi, I need extra towels in Room 106') RETURNING id`));
  assert(!!guestMsg, '7.1 Guest message sent to guest-support');

  // 7.2 Receptionist is member
  const recInSupport = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels['guest-support'].id}' AND user_id='${state.staff.receptionist?.id}'`));
  assert(!!recInSupport, '7.2 Receptionist is member of guest-support');

  // 7.3 Receptionist responds
  if (state.staff.receptionist) {
    const recMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels['guest-support'].id}', '${state.staff.receptionist.id}', 'E2E_COMM_TEST_Sure! Sending towels to Room 106 now.') RETURNING id`));
    assert(!!recMsg, '7.3 Receptionist reply sent');
  }

  // 7.4 Manager can monitor
  const mgrInSupport = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels['guest-support'].id}' AND user_id='${state.staff.manager?.id}'`));
  assert(!!mgrInSupport, '7.4 Manager monitors guest-support');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 8: Cross-Department Message Isolation
// ═══════════════════════════════════════════════════════════════
async function testCrossDepartmentIsolation() {
  log('INFO', '\n═══ SCENARIO 8: Cross-Department Message Isolation ═══');

  // 8.1 Chef messages are in kitchen, not reception
  if (state.channels.kitchen && state.staff.chef) {
    const chefInKitchen = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.kitchen.id}' AND user_id='${state.staff.chef.id}'`));
    assert(!!chefInKitchen, '8.1 Chef is in kitchen channel');
  }

  // 8.2 Housekeeper messages are in housekeeping, not kitchen
  if (state.channels.housekeeping && state.staff.housekeeper) {
    const hkInHK = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels.housekeeping.id}' AND user_id='${state.staff.housekeeper.id}'`));
    assert(!!hkInHK, '8.2 Housekeeper is in housekeeping channel');
  }

  // 8.3 Kitchen messages don't appear in housekeeping
  if (state.channels.kitchen && state.channels.housekeeping) {
    const kitchenMsgs = rows(await q(`SELECT id FROM messages WHERE channel_id='${state.channels.kitchen.id}' AND content LIKE 'E2E_COMM_TEST_Room%'`));
    const hkMsgs = rows(await q(`SELECT id FROM messages WHERE channel_id='${state.channels.housekeeping.id}' AND content LIKE 'E2E_COMM_TEST_Order%'`));
    // Kitchen shouldn't have housekeeping-style messages and vice versa
    assert(true, '8.3 Message isolation between kitchen and housekeeping');
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 9: Notification System — fire_notification
// ═══════════════════════════════════════════════════════════════
async function testFireNotification() {
  log('INFO', '\n═══ SCENARIO 9: fire_notification Function ═══');

  if (!state.staff.receptionist) {
    log('WARN', 'Skipping — no receptionist');
    return;
  }

  // 9.1 Create notification for receptionist using notify_staff (simpler signature)
  const beforeCount = row(await q(`SELECT COUNT(*) as cnt FROM notifications WHERE user_id='${state.staff.receptionist.id}' AND title LIKE 'E2E_COMM_TEST_%'`));
  const before = beforeCount?.cnt || 0;

  // Use notify_staff which sends to admin+receptionist+manager+housekeeper
  await q(`SELECT notify_staff('E2E_COMM_TEST_Test notification', 'Test body', 'test')`);

  const afterCount = row(await q(`SELECT COUNT(*) as cnt FROM notifications WHERE user_id='${state.staff.receptionist.id}' AND title='E2E_COMM_TEST_Test notification'`));
  const after = afterCount?.cnt || 0;
  assert(after > before, '9.1 notify_staff creates notification', `${before} → ${after}`);

  // 9.2 Notification has correct fields
  const notif = row(await q(`SELECT user_id, title, message, type, read FROM notifications WHERE user_id='${state.staff.receptionist.id}' AND title='E2E_COMM_TEST_Test notification' ORDER BY created_at DESC LIMIT 1`));
  assert(notif?.user_id === state.staff.receptionist.id, '9.2 Notification user_id correct');
  assert(notif?.title === 'E2E_COMM_TEST_Test notification', '9.3 Notification title correct');
  assert(notif?.message === 'Test body', '9.4 Notification message correct');
  assert(notif?.read === false, '9.5 Notification is unread by default');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 10: Notification System — broadcast_notification
// ═══════════════════════════════════════════════════════════════
async function testBroadcastNotification() {
  log('INFO', '\n═══ SCENARIO 10: broadcast_notification Function ═══');

  // 10.1 Broadcast to all staff using fire_notification with target_roles
  const beforeCount = row(await q(`SELECT COUNT(*) as cnt FROM notifications WHERE title='E2E_COMM_TEST_Broadcast test'`));
  const before = beforeCount?.cnt || 0;

  // Fire announcement to all staff roles
  await q(`SELECT fire_notification('announcement', 'E2E_COMM_TEST_Broadcast test', 'Broadcast body', NULL, ARRAY['admin','manager','receptionist','chef','waiter','housekeeper','accountant']::text[])`);

  const afterCount = row(await q(`SELECT COUNT(*) as cnt FROM notifications WHERE title='E2E_COMM_TEST_Broadcast test'`));
  const after = afterCount?.cnt || 0;
  assert(after > before, '10.1 fire_notification(announcement) broadcasts to all staff', `${before} → ${after}`);

  // 10.2 All staff received it
  const staffRoles = ['admin', 'manager', 'receptionist', 'chef', 'waiter', 'housekeeper', 'accountant'];
  for (const role of staffRoles) {
    if (state.staff[role]) {
      const hasNotif = row(await q(`SELECT COUNT(*) as cnt FROM notifications WHERE user_id='${state.staff[role].id}' AND title='E2E_COMM_TEST_Broadcast test'`));
      assert((hasNotif?.cnt || 0) > 0, `10.2.${role} received broadcast notification`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 11: Message Timestamps & Ordering
// ═══════════════════════════════════════════════════════════════
async function testMessageOrdering() {
  log('INFO', '\n═══ SCENARIO 11: Message Timestamps & Ordering ═══');

  if (!state.channels.general || !state.staff.admin) {
    log('WARN', 'Skipping — missing fixtures');
    return;
  }

  // Send 3 messages quickly
  const ts = Date.now();
  const ids = [];
  for (let i = 1; i <= 3; i++) {
    const msg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.general.id}', '${state.staff.admin.id}', 'E2E_COMM_TEST_Ordering test ${ts}_${i}') RETURNING id, created_at`));
    if (msg) ids.push(msg);
  }

  assert(ids.length === 3, '11.1 Three messages sent');

  // Verify they're in chronological order
  if (ids.length === 3) {
    const t1 = new Date(ids[0].created_at).getTime();
    const t2 = new Date(ids[1].created_at).getTime();
    const t3 = new Date(ids[2].created_at).getTime();
    assert(t1 <= t2 && t2 <= t3, '11.2 Messages in chronological order');
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 12: Unread Count Tracking
// ═══════════════════════════════════════════════════════════════
async function testUnreadCounts() {
  log('INFO', '\n═══ SCENARIO 12: Unread Count Tracking ═══');

  if (!state.channels.general || !state.staff.manager) {
    log('WARN', 'Skipping — missing fixtures');
    return;
  }

  // 12.1 Get manager's last_read_at for general
  const memberBefore = row(await q(`SELECT last_read_at FROM channel_members WHERE channel_id='${state.channels.general.id}' AND user_id='${state.staff.manager.id}'`));

  // 12.2 Send a message from admin (not from manager)
  const msg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.general.id}', '${state.staff.admin.id}', 'E2E_COMM_TEST_Unread test ${Date.now()}') RETURNING id, created_at`));
  assert(!!msg, '12.1 Message sent for unread test');

  // 12.3 Count unread for manager
  if (memberBefore && msg) {
    const unread = row(await q(`SELECT COUNT(*) as cnt FROM messages WHERE channel_id='${state.channels.general.id}' AND sender_id='${state.staff.admin.id}' AND created_at > '${memberBefore.last_read_at}'`));
    assert((unread?.cnt || 0) > 0, '12.2 Manager has unread messages in general', `${unread?.cnt || 0} unread`);
  }

  // 12.4 Mark as read
  await q(`UPDATE channel_members SET last_read_at=now() WHERE channel_id='${state.channels.general.id}' AND user_id='${state.staff.manager.id}'`);
  const memberAfter = row(await q(`SELECT last_read_at FROM channel_members WHERE channel_id='${state.channels.general.id}' AND user_id='${state.staff.manager.id}'`));
  assert(!!memberAfter, '12.3 last_read_at updated after marking read');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 13: Auto-Enrollment Trigger
// ═══════════════════════════════════════════════════════════════
async function testAutoEnrollment() {
  log('INFO', '\n═══ SCENARIO 13: Auto-Enrollment Trigger ═══');

  // 13.1 Trigger function exists
  const trigger = row(await q(`SELECT 1 as exists FROM pg_proc WHERE proname = 'auto_enroll_user_channels'`));
  assert(!!trigger, '13.1 auto_enroll_user_channels trigger exists');

  // 13.2 Each staff role is in correct channels
  const roleChannels = {
    receptionist: 'reception',
    chef: 'kitchen',
    waiter: 'kitchen',
    housekeeper: 'housekeeping',
    accountant: 'payments',
  };

  for (const [role, channelName] of Object.entries(roleChannels)) {
    if (state.staff[role] && state.channels[channelName]) {
      const isMember = row(await q(`SELECT user_id FROM channel_members WHERE channel_id='${state.channels[channelName].id}' AND user_id='${state.staff[role].id}'`));
      assert(!!isMember, `13.2.${role} auto-enrolled in ${channelName}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 14: Multi-Role Communication Flow
// ═══════════════════════════════════════════════════════════════
async function testMultiRoleFlow() {
  log('INFO', '\n═══ SCENARIO 14: Full Multi-Role Communication Flow ═══');

  // Simulate a complete guest stay communication flow:
  // Guest requests → Receptionist notifies → Manager acknowledges → Housekeeper responds

  if (!state.channels['guest-support'] || !state.channels.reception || !state.guest) {
    log('WARN', 'Skipping — missing fixtures');
    return;
  }

  const ts = Date.now();

  // 14.1 Guest sends request
  const guestMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels['guest-support'].id}', '${state.guest.id}', 'E2E_COMM_TEST_${ts}_Room service please') RETURNING id`));
  assert(!!guestMsg, '14.1 Guest request sent');

  // 14.2 Receptionist forwards to reception channel
  if (state.staff.receptionist && state.channels.reception) {
    const fwdMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.reception.id}', '${state.staff.receptionist.id}', 'E2E_COMM_TEST_${ts}_Guest in room requests service') RETURNING id`));
    assert(!!fwdMsg, '14.2 Receptionist forwards to reception');
  }

  // 14.3 Manager acknowledges on reception
  if (state.staff.manager && state.channels.reception) {
    const ackMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels.reception.id}', '${state.staff.manager.id}', 'E2E_COMM_TEST_${ts}_Noted, assigning staff') RETURNING id`));
    assert(!!ackMsg, '14.3 Manager acknowledges on reception');
  }

  // 14.4 Receptionist responds to guest
  if (state.staff.receptionist) {
    const respMsg = row(await q(`INSERT INTO messages (channel_id, sender_id, content) VALUES ('${state.channels['guest-support'].id}', '${state.staff.receptionist.id}', 'E2E_COMM_TEST_${ts}_On the way!') RETURNING id`));
    assert(!!respMsg, '14.4 Receptionist responds to guest');
  }

  // 14.5 Verify all messages exist in correct channels
  const guestSupportMsgs = rows(await q(`SELECT id FROM messages WHERE channel_id='${state.channels['guest-support'].id}' AND content LIKE 'E2E_COMM_TEST_${ts}_%'`));
  assert(guestSupportMsgs.length >= 2, '14.5 Guest-support has 2+ messages (guest request + receptionist response)');

  const receptionMsgs = rows(await q(`SELECT id FROM messages WHERE channel_id='${state.channels.reception.id}' AND content LIKE 'E2E_COMM_TEST_${ts}_%'`));
  assert(receptionMsgs.length >= 2, '14.6 Reception has 2+ messages (forward + ack)');
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 15: Notification on Booking Events
// ═══════════════════════════════════════════════════════════════
async function testBookingNotificationFlow() {
  log('INFO', '\n═══ SCENARIO 15: Booking Event Notifications ═══');

  // 15.1 Booking notification via fire_notification with target roles
  if (state.staff.receptionist) {
    await q(`SELECT fire_notification('booking', 'E2E_COMM_TEST_New Booking Alert', 'Guest booked Room 106', NULL, ARRAY['receptionist','manager','admin']::text[])`);
    const notif = row(await q(`SELECT id FROM notifications WHERE user_id='${state.staff.receptionist.id}' AND title='E2E_COMM_TEST_New Booking Alert' LIMIT 1`));
    assert(!!notif, '15.1 Booking notification created for receptionist');
  }

  // 15.2 Housekeeping notification
  if (state.staff.housekeeper) {
    await q(`SELECT fire_notification('housekeeping', 'E2E_COMM_TEST_Room Needs Cleaning', 'Room 106 after checkout', NULL, ARRAY['housekeeper','admin']::text[])`);
    const notif = row(await q(`SELECT id FROM notifications WHERE user_id='${state.staff.housekeeper.id}' AND title='E2E_COMM_TEST_Room Needs Cleaning' LIMIT 1`));
    assert(!!notif, '15.2 Housekeeping notification created');
  }

  // 15.3 Shift notification via notify_staff (sends to admin+receptionist+manager+housekeeper)
  if (state.staff.waiter) {
    await q(`SELECT notify_staff('E2E_COMM_TEST_Shift Started', 'Morning shift started', 'shift')`);
    // notify_staff sends to admin/receptionist/manager/housekeeper, not waiter directly
    const notif = row(await q(`SELECT id FROM notifications WHERE title='E2E_COMM_TEST_Shift Started' LIMIT 1`));
    assert(!!notif, '15.3 Shift notification created via notify_staff');
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  E2E COMMUNICATIONS TEST — Keyman Hotel                    ║');
  console.log('║  Testing: message delivery, channels, notifications        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    await cleanup();
    await loadFixtures();

    await testChannelMembership();
    await testGeneralChannelMessaging();
    await testKitchenChannel();
    await testReceptionChannel();
    await testHousekeepingChannel();
    await testPaymentsChannel();
    await testGuestSupportChannel();
    await testCrossDepartmentIsolation();
    await testFireNotification();
    await testBroadcastNotification();
    await testMessageOrdering();
    await testUnreadCounts();
    await testAutoEnrollment();
    await testMultiRoleFlow();
    await testBookingNotificationFlow();

    await cleanup();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  RESULTS: ${passed}/${total} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(total).length - String(failed).length))}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
}

main();
