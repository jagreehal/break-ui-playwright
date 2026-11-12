// break-ui Phase 1 and 2: the field map, and one dataset per toggle position, shaped like the API response.
// Values come from skills/break-ui/CATALOG.md. Times are relative to NOW; the tests pin the clock to it.
export const NOW = Date.parse('2026-11-12T12:00:00Z');
const ago = (s) => new Date(NOW - s * 1000).toISOString();
const DAY = 86400;

/** Phase 1: every value the member row renders. No schema here, so every string is unbounded (a Fragile finding). */
export const fields = [
  ['workspace.name', 'heading', 'string', 'unbounded', 'No'],
  ['workspace.inviteLabel', 'button label (translated)', 'string', 'unbounded', 'No'],
  ['members.length', 'header count, list', 'int', 'unbounded, unpaginated API', 'No'],
  ['member.name', 'name, avatar initials', 'string', 'unbounded', 'Yes (invited by email)'],
  ['member.email', 'second line', 'string', 'unbounded', 'No'],
  ['member.role', 'third line', 'string', 'unbounded', 'Yes'],
  ['member.avatar', 'avatar image', 'URL', '—', 'Yes'],
  ['member.status', 'badge', 'active | invited | expired', '—', 'No'],
  ['member.projects', 'count', 'int', '—', 'Yes (null from API)'],
  ['member.lastActive', 'relative time', 'ISO date', '—', 'Yes'],
  ['member.tags', 'tag row', 'string[]', 'unbounded', 'No'],
];

const PANORAMA = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200"><rect width="4000" height="200" fill="#7c3aed"/></svg>')}`;
const TALL = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="4000"><rect width="200" height="4000" fill="#0891b2"/></svg>')}`;

const member = (m) => ({ role: 'Designer', avatar: null, status: 'active', projects: 3, lastActive: ago(7200), tags: ['design'], ...m });

const demo = {
  workspace: { name: 'Acme', inviteLabel: 'Invite' },
  members: [
    member({ name: 'Jane Doe', email: 'jane@acme.example.com', projects: 12, tags: ['design', 'web'] }),
    member({ name: 'John Smith', email: 'john@acme.example.com', role: 'Engineer', projects: 4, lastActive: ago(3 * 3600) }),
    member({ name: 'Ana Lima', email: 'ana@acme.example.com', role: 'PM', status: 'invited', projects: 7 }),
  ],
};

// Hard Rule 3: one dataset, a different failure per row, as real data mixes them.
const worst = {
  workspace: { name: 'Benachrichtigungseinstellungen-Arbeitsbereich', inviteLabel: "Inviter des membres de l'espace" },
  members: [
    member({ name: 'Aleksandra Wiśniewska-Kowalczyk', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', role: 'Senior Product Design Engineer, Platform Infrastructure', status: 'expired', projects: 1, lastActive: ago(12 * DAY), avatar: PANORAMA, tags: ['design', 'frontend', 'q3', 'urgent', 'needs-review', 'mobile', 'growth', 'brand', 'research', 'a11y', 'infra', 'docs'] }),
    member({ name: 'Christopher Alexander Montgomery III', email: 'a@b.co', role: null, status: 'invited', projects: 1284, lastActive: ago(-3 * DAY), avatar: '/avatars/missing.png', tags: ['customer-feedback-from-enterprise-onboarding'] }),
    member({ name: 'Jo', email: 'first.last+billing-notifications@example.com', role: '', projects: 0, lastActive: new Date(0).toISOString(), tags: [] }),
    member({ name: '🦊 Fox', email: 'fox@example.com', projects: null, lastActive: ago(0), avatar: TALL }),
    member({ name: '  Sam   Lee ', email: 'ops@sub.department.region.example.co.uk', projects: 1, lastActive: ago(1 * DAY) }),
    member({ name: 'Đặng Thị Ngọc Hân', email: 'han@example.com', role: 'Kỹ sư phần mềm', projects: 2 }),
    member({ name: '王秀英', email: 'wang@example.com', projects: 21 }),
    member({ name: 'نور الهدى عبد الرحمن', email: 'noor@example.com', projects: 5 }),
    member({ name: '<b>Bold</b> & Co', email: 'bold@example.com', role: 'Line one\nLine two', projects: 3 }),
    member({ name: '', email: 'invitee@example.com', status: 'invited', projects: 0, lastActive: null }),
  ],
};

const huge = {
  workspace: demo.workspace,
  members: Array.from({ length: 1000 }, (_, i) => member({ name: `Member ${i + 1}`, email: `member${i + 1}@acme.example.com` })),
};

export const datasets = {
  demo,
  worst,
  empty: { workspace: demo.workspace, members: [] },
  one: { workspace: demo.workspace, members: [member({ name: 'Jane Doe', email: 'jane@acme.example.com', projects: 1, lastActive: ago(DAY) })] },
  huge,
};
