// The backend has no "Waiting for Documents" status — DocumentController's
// requestDocuments() is a pure notification that leaves status at
// "Under Verification" and just logs a "DOCUMENTS_REQUESTED" history entry
// (see LoanLite/src/main/java/.../DocumentController.java). We derive a
// "Waiting for Documents" *display* status purely from that history so the
// applicant gets a clear signal without needing any backend change —
// applicationHistory is already nested on every LoanApplication response,
// so this costs no extra call.
export const DOCUMENTS_REQUESTED_ACTION = 'DOCUMENTS_REQUESTED';

export const getDisplayStatus = (application) => {
  if (!application || application.status !== 'Under Verification') {
    return application?.status;
  }

  const history = application.applicationHistory || [];
  const latest = history.reduce(
    (latestSoFar, entry) =>
      !latestSoFar || new Date(entry.createdAt) > new Date(latestSoFar.createdAt) ? entry : latestSoFar,
    null
  );

  return latest?.action === DOCUMENTS_REQUESTED_ACTION ? 'Waiting for Documents' : application.status;
};

export const isWaitingForDocuments = (application) => getDisplayStatus(application) === 'Waiting for Documents';
