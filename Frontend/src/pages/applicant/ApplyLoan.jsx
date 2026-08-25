import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Loader from '../../components/Loader';
import loanService from '../../services/loanService';
import { Check } from 'lucide-react';

const STEPS = ['Loan Details', 'Income Details', 'Review'];

// Mirrors LoanApplication.MIN_LOAN_AMOUNT/MAX_LOAN_AMOUNT — the backend
// rejects anything outside this range with a 400 on create/update, so catch
// it here first with a clear message instead of a generic request failure.
const MIN_LOAN_AMOUNT = 50000;
const MAX_LOAN_AMOUNT = 2500000;

// Mirrors LoanApplicationService.FIXED_ANNUAL_INTEREST_RATE / calculateEmi —
// every application gets this same fixed rate server-side, so the estimate
// shown here before submission matches what the backend will persist.
const FIXED_ANNUAL_INTEREST_RATE = 12.0;

const calculateEmi = (principal, tenureMonths) => {
  const p = Number(principal);
  const n = Number(tenureMonths);
  if (!p || !n || p <= 0 || n <= 0) return null;
  const monthlyRate = FIXED_ANNUAL_INTEREST_RATE / 1200;
  const compounded = Math.pow(1 + monthlyRate, n);
  const denominator = compounded - 1;
  if (denominator === 0) return null;
  return (p * monthlyRate * compounded) / denominator;
};

const getLoanAmountError = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const amount = Number(value);
  if (amount > MAX_LOAN_AMOUNT) {
    return `Limit exceeded — maximum loan amount is ₹${MAX_LOAN_AMOUNT.toLocaleString('en-IN')}`;
  }
  if (amount < MIN_LOAN_AMOUNT) {
    return `Minimum loan amount is ₹${MIN_LOAN_AMOUNT.toLocaleString('en-IN')}`;
  }
  return '';
};

const selectClass =
  'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all';

const ApplyLoan = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [initializing, setInitializing] = useState(isEditMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    loanAmount: '',
    loanTerm: '',
    income: '',
  });

  useEffect(() => {
    if (!isEditMode) return;

    const loadDraft = async () => {
      try {
        setInitializing(true);
        const { data: app } = await loanService.getApplicationById(id);
        if (app.status !== 'Draft') {
          setError('This application can no longer be edited — it has left Draft status.');
          return;
        }
        setFormData({
          loanAmount: app.loanAmount ?? '',
          loanTerm: app.tenureMonths ?? '',
          income: app.declaredIncome ?? '',
        });
      } catch (err) {
        setError(err.message || 'Failed to load draft application');
      } finally {
        setInitializing(false);
      }
    };

    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.loanAmount || !formData.loanTerm) {
        setError('Please fill in all fields');
        return;
      }
      const amountError = getLoanAmountError(formData.loanAmount);
      if (amountError) {
        setError(amountError);
        return;
      }
    }
    if (step === 2 && !formData.income) {
      setError('Please fill in all fields');
      return;
    }
    setStep(step + 1);
    setError('');
  };

  const handlePrevious = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    setError('');
    try {
      if (isEditMode) {
        await loanService.updateDraftApplication(id, formData);
      } else {
        await loanService.createApplication({ ...formData, status: 'draft' });
      }
      setSuccess('Draft saved successfully!');
      setTimeout(() => navigate('/applicant/my-applications'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Create/update always lands as Draft server-side regardless of what
      // status is sent — actually moving to Submitted requires the
      // dedicated submit action on the application.
      const applicationId = isEditMode
        ? (await loanService.updateDraftApplication(id, formData)).data.id
        : (await loanService.createApplication({ ...formData, status: 'draft' })).data.id;
      await loanService.submitApplication(applicationId);
      setSuccess('Application submitted successfully!');
      setTimeout(() => navigate('/applicant/my-applications'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) return <Loader fullScreen />;

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4">
      <Card className="p-6 sm:p-8">
        {/* Header + progress */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {isEditMode ? 'Edit Your Draft Application' : 'Apply for a Personal Loan'}
          </h1>
          <p className="text-gray-500 mb-4">Step {step} of 3 &mdash; {STEPS[step - 1]}</p>
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => {
              const num = i + 1;
              const done = num < step;
              const current = num === step;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        done
                          ? 'bg-primary-600 text-white'
                          : current
                          ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {done ? <Check size={14} /> : num}
                    </div>
                    <span className={`hidden sm:inline text-sm font-medium ${current ? 'text-gray-800' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                  {num < STEPS.length && <div className={`flex-1 h-0.5 ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-6">Loan Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <Input
                label="Loan Amount (₹)"
                name="loanAmount"
                type="number"
                value={formData.loanAmount}
                onChange={handleChange}
                placeholder="50,000 to 25,00,000"
                min="50000"
                max="2500000"
                required
                error={getLoanAmountError(formData.loanAmount)}
              />
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-1.5 text-sm">
                  Loan Term (months) <span className="text-red-500">*</span>
                </label>
                <select name="loanTerm" value={formData.loanTerm} onChange={handleChange} className={selectClass}>
                  <option value="">Select loan term</option>
                  <option value="12">12 months</option>
                  <option value="24">24 months</option>
                  <option value="36">36 months</option>
                  <option value="48">48 months</option>
                  <option value="60">60 months</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-6">Income Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <Input
                label="Monthly Income (₹)"
                name="income"
                type="number"
                value={formData.income}
                onChange={handleChange}
                placeholder="Enter your monthly income"
                required
              />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-6">Review Your Application</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Loan Amount</p>
                <p className="text-2xl font-bold text-primary-600">₹{parseInt(formData.loanAmount || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Loan Term</p>
                <p className="text-2xl font-bold text-gray-800">{formData.loanTerm} months</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Monthly Income</p>
                <p className="text-lg font-semibold text-gray-800">₹{parseInt(formData.income || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Estimated Monthly EMI</p>
                <p className="text-lg font-semibold text-gray-800">
                  {(() => {
                    const emi = calculateEmi(formData.loanAmount, formData.loanTerm);
                    return emi
                      ? `₹${emi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                      : '—';
                  })()}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Estimated at {FIXED_ANNUAL_INTEREST_RATE}% p.a. — the fixed rate applied to every loan.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={handlePrevious} disabled={loading}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {/* Every required field (including income, collected in step 2) must
                be filled before a draft can be saved — the backend validates the
                full application on create/update, so offering this earlier just
                guarantees a 400. */}
            {step === 3 && (
              <Button variant="outline" onClick={handleSaveDraft} loading={loading}>
                Save as Draft
              </Button>
            )}
            {step < 3 ? (
              <Button variant="primary" onClick={handleNext} disabled={loading}>
                Next
              </Button>
            ) : (
              <Button variant="success" onClick={handleSubmit} loading={loading}>
                Submit Application
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ApplyLoan;
