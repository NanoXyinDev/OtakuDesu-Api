/* Peran dan batas pemakaian. Ubah di sini atau lewat env ROLE_LIMITS (JSON), contoh:
   ROLE_LIMITS={"user":{"rpm":100,"daily":5000},"vip":{"label":"VIP","rpm":400,"daily":null}}
   rpm = request per menit, daily = request per hari. null = tanpa batas. */
const DEFAULTS = {
  guest: { label: "Tamu (tanpa login)", rpm: 10, daily: 200 },
  user: { label: "Pengguna", rpm: 60, daily: 3000 },
  premium: { label: "Premium", rpm: 180, daily: 30000 },
  admin: { label: "Admin", rpm: null, daily: null },
};

let ROLES = JSON.parse(JSON.stringify(DEFAULTS));
try {
  const extra = JSON.parse(process.env.ROLE_LIMITS || "{}");
  for (const [k, v] of Object.entries(extra)) ROLES[k] = { ...(ROLES[k] || { label: k }), ...v };
} catch (e) { console.warn("ROLE_LIMITS bukan JSON valid, dipakai nilai bawaan"); }

const limitsFor = (role) => {
  const r = ROLES[role] || ROLES.user;
  return { rpm: r.rpm == null ? Infinity : r.rpm, daily: r.daily == null ? Infinity : r.daily };
};
const isRole = (r) => Object.prototype.hasOwnProperty.call(ROLES, r) && r !== "guest";
const publicRoles = () => Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { label: v.label || k, rpm: v.rpm, daily: v.daily }]));

module.exports = { ROLES, limitsFor, isRole, publicRoles };
