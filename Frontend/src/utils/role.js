// Backend authorities are Spring-Security-style ("ROLE_ADMIN"); the frontend
// works with plain lowercase roles ("admin"). Normalize wherever a raw role
// string comes back from the API (e.g. GET /api/users, nested applicant/
// processor/underwriter on a loan application).
export const stripRolePrefix = (role) => {
  if (!role) return role;
  return role.startsWith('ROLE_') ? role.slice(5).toLowerCase() : role.toLowerCase();
};

export const fullName = (person) => {
  if (!person) return 'N/A';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'N/A';
};
