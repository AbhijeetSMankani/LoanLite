import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Loader from '../../components/Loader';
import loanService from '../../services/loanService';

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
    setFormData(prev => ({
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
    }
    if (step === 2) {
      if (!formData.purpose || !formData.income) {
        setError('Please fill in all fields');
        return;
      }
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
      const response = await loanService.createApplication({
        ...formData,
        status: 'draft',
      });
      setSuccess('Draft saved successfully!');
      setTimeout(() => navigate('/applicant/my-applications'), 2000);
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
      const response = await loanService.createApplication({
        ...formData,
        status: 'submitted',
      });
      setSuccess('Application submitted successfully!');
      setTimeout(() => navigate('/applicant/my-applications'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader fullScreen message="Processing..." />;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Apply for a Personal Loan</h1>
          <p className="text-gray-600">Step {step} of 3</p>
          <div className="mt-4 bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Step 1: Loan Details */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Loan Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Loan Term (months) <span className="text-red-500">*</span>
                </label>
                <select
                  name="loanTerm"
                  value={formData.loanTerm}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
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

        {/* Step 2: Personal Details */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Personal Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Review Your Application</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg">
              <div>
                <p className="text-gray-600 text-sm">Loan Amount</p>
                <p className="text-2xl font-bold text-orange-600">₹{parseInt(formData.loanAmount || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Loan Term</p>
                <p className="text-2xl font-bold text-gray-800">{formData.loanTerm} months</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Purpose</p>
                <p className="text-lg font-semibold text-gray-800">{formData.purpose}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Monthly Income</p>
                <p className="text-lg font-semibold text-gray-800">₹{parseInt(formData.income || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-8 flex justify-between gap-4">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={handlePrevious} disabled={loading}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
              Save as Draft
            </Button>
            {step < 3 ? (
              <Button variant="primary" onClick={handleNext} disabled={loading}>
                Next
              </Button>
            ) : (
              <Button variant="success" onClick={handleSubmit} disabled={loading}>
                Submit Application
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplyLoan;