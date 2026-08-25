// The backend hardcodes "ADDRESS_PROOF" as one of the three required document
// type constants (ProcessorController/DocumentController/LoanApplicationController
// all share this literal) — that value must still be sent/matched exactly.
// Only the human-facing label changes: address proof in this product is
// specifically an Aadhaar card.
export const DOCUMENT_TYPE_LABELS = {
  PAN_CARD: 'PAN Card',
  SALARY_SLIP: 'Salary Slip',
  ADDRESS_PROOF: 'Aadhaar',
  OTHER: 'Other',
};

export const documentTypeLabel = (type) => DOCUMENT_TYPE_LABELS[type?.toUpperCase()] || type || 'Other';
