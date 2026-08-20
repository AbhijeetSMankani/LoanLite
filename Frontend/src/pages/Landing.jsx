import React from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark,
  FileText,
  ShieldCheck,
  Gavel,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';

const FEATURES = [
  {
    icon: FileText,
    title: 'Apply Online',
    description: 'Fill a simple multi-step form and save it as a draft to finish later.',
  },
  {
    icon: ShieldCheck,
    title: 'Upload Documents',
    description: 'Submit your papers digitally and track exactly what is still pending.',
  },
  {
    icon: ClipboardCheck,
    title: 'Track Every Step',
    description: 'See your application move from Submitted to Decided in real time.',
  },
  {
    icon: Gavel,
    title: 'Fast Decisions',
    description: 'Underwriters review verified applications and give a clear final answer.',
  },
];

const STEPS = [
  { step: '01', title: 'Apply', description: 'Tell us how much you need and for how long.' },
  { step: '02', title: 'Verify', description: 'Upload documents; our team checks and confirms them.' },
  { step: '03', title: 'Decide', description: 'Get an Approved, Rejected, or Referred decision.' },
];

const Landing = () => {
  return (
    <div className="min-h-screen w-full bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <span className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <Landmark size={18} />
            </span>
            LoanLite
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="secondary" size="sm">
                Login
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-5">
            Personal loans, <span className="text-primary-600">without the paperwork chaos.</span>
          </h1>
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Apply for a personal loan, upload your documents, and track every step of your
            application from one simple dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button variant="primary" size="lg">
                Get Started <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Login to your account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Everything you need, in one place</h2>
          <p className="text-gray-500">Built for applicants, processors, underwriters, and admins alike.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="hover:shadow-md transition-shadow">
              <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                <Icon size={22} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">{title}</h3>
              <p className="text-gray-500 text-sm">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">How it works</h2>
            <p className="text-gray-500">Three steps from application to decision.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map(({ step, title, description }) => (
              <div key={step} className="text-center px-4">
                <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold mx-auto mb-4">
                  {step}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
                <p className="text-gray-500 text-sm">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Ready to get started?</h2>
        <p className="text-gray-500 mb-8">Create your account and apply for a loan in minutes.</p>
        <Link to="/signup">
          <Button variant="primary" size="lg">
            Create your account <ArrowRight size={18} />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear() || '2026'} LoanLite. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
