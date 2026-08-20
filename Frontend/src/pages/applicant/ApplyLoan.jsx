import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import loanService from '../../services/loanService';
import { Check } from 'lucide-react';

const STEPS = ['Loan Details', 'Personal Details', 'Review'];

const selectClass =
  'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all';

const ApplyLoan = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    loanAmount: '',
    loanTerm: '',
    purpose: '',
    income: '',
    employment: '',
    employmentDuration: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleNext = () => {
    if (step === 1 && (!formData.loanAmount || !formData.loanTerm)) {
      setError('Please fill in all fields');
      return;
    }
    if (step === 2 && (!formData.purpose || !formData.income)) {
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
      await loanService.createApplication({ ...formData, status: 'draft' });
      setSuccess('Draft saved successfully!');
      setTimeout(() => navigate('/applicant/my-applications'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await loanService.createApplication({ ...formData, status: 'submitted' });
      setSuccess('Application submitted successfully!');
      setTimeout(() => navigate('/applicant/my-applications'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4">
      <Card className="p-6 sm:p-8">
        {/* Header + progress */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Apply for a Personal Loan</h1>
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
            <h2 className="text-lg font-bold text-gray-800 mb-6">Personal Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <Input
                label="Loan Purpose"
                name="purpose"
                type="text"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="e.g., Home renovation, Education"
                required
              />
              <Input
                label="Monthly Income (₹)"
                name="income"
                type="number"
                value={formData.income}
                onChange={handleChange}
                placeholder="Enter your monthly income"
                required
              />
              <Input
                label="Employment Type"
                name="employment"
                type="text"
                value={formData.employment}
                onChange={handleChange}
                placeholder="e.g., Salaried, Self-employed"
              />
              <Input
                label="Employment Duration (years)"
                name="employmentDuration"
                type="number"
                value={formData.employmentDuration}
                onChange={handleChange}
                placeholder="Years at current job"
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
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Purpose</p>
                <p className="text-lg font-semibold text-gray-800">{formData.purpose}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Monthly Income</p>
                <p className="text-lg font-semibold text-gray-800">₹{parseInt(formData.income || 0).toLocaleString()}</p>
              </div>
            </div>
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
            <Button variant="outline" onClick={handleSaveDraft} loading={loading}>
              Save as Draft
            </Button>
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
