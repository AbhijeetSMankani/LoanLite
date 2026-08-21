// Backend authorities are Spring-Security-style ("ROLE_ADMIN"); the frontend
// works with plain lowercase roles ("admin"). Normalize wherever a raw role
// string comes back from the API (e.g. GET /api/users, nested applicant/
// processor/underwriter on a loan application).
export const stripRolePrefix = (role) => {
  if (!role) return role;
  const normalized = role.startsWith('ROLE_') ? role.slice(5).toLowerCase() : role.toLowerCase();
  // The backend's /auth/register always persists new accounts as ROLE_USER
  // (it has no concept of "applicant" at signup time) — that's this app's
  // baseline self-serve role, so treat it as an applicant everywhere.
  return normalized === 'user' ? 'applicant' : normalized;
};

export const fullName = (person) => {
  if (!person) return 'N/A';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'N/A';
};
