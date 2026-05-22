import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, XCircle, Zap, AlertTriangle, ChevronDown, FileText, Sparkles } from 'lucide-react';
import { supabase, computeOnboardingState, computeSuggestedAction, buildAiSummary, computeIssueSeverity, computeReviewOwner, computeIntegrationHealth } from './supabaseClient';
import type {
  PartnerOnboarding,
  VerificationStatus,
  ApiSetupStatus,
  PayoutSetupStatus,
  IssueSeverity,
  IntegrationHealth,
} from './supabaseClient';

const initialForm = {
  company_name: '',
  verification_status: 'Pending' as VerificationStatus,
  api_setup_status: 'Pending' as ApiSetupStatus,
  payout_setup_status: 'Pending' as PayoutSetupStatus,
  notes: '',
};

async function fetchAiSummary(
  company_name: string,
  verification_status: string,
  api_setup_status: string,
  payout_setup_status: string
): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-summary`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ company_name, verification_status, api_setup_status, payout_setup_status }),
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.summary ?? '';
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    Verified: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
    Connected: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
    Complete: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
    Pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={13} /> },
    Failed: { color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle size={13} /> },
    'Ready for Activation': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Zap size={13} /> },
    'Pending Review': { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertTriangle size={13} /> },
    'Critical': { color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle size={13} /> },
    'Review Needed': { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: <AlertTriangle size={13} /> },
    'Ready': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
  };

  const config = map[value] ?? { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: null };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {value}
    </span>
  );
}

function IntegrationHealthBadge({ value }: { value: IntegrationHealth }) {
  const map: Record<IntegrationHealth, { color: string; dot: string }> = {
    Healthy:  { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    Degraded: { color: 'bg-orange-50 text-orange-700 border-orange-200',   dot: 'bg-orange-500'  },
    Failed:   { color: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-500'     },
  };
  const { color, dot } = map[value];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {value}
    </span>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState<PartnerOnboarding[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'All'>('All');

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('partner_onboarding')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRecords(data as PartnerOnboarding[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSubmitting(true);
    setError(null);

    const ai_summary =
      (await fetchAiSummary(
        form.company_name,
        form.verification_status,
        form.api_setup_status,
        form.payout_setup_status
      )) || buildAiSummary(form.verification_status, form.api_setup_status, form.payout_setup_status);

    const { error } = await supabase
      .from('partner_onboarding')
      .insert([{ ...form, ai_summary }]);

    if (error) {
      setError(error.message);
    } else {
      setForm(initialForm);
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 2500);
      await fetchRecords();
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 size={17} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900 leading-none block">Partner Payments</span>
            <span className="text-xs text-gray-400 leading-none">Onboarding Dashboard</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Form Card */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Partner Record</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fill in the onboarding details for a new partner.</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            {/* Company Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Payments Inc."
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                className="bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Status selects */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField
                label="Verification Status"
                value={form.verification_status}
                onChange={(v) => setForm((f) => ({ ...f, verification_status: v }))}
                options={['Verified', 'Pending', 'Failed']}
              />
              <SelectField
                label="API Setup Status"
                value={form.api_setup_status}
                onChange={(v) => setForm((f) => ({ ...f, api_setup_status: v }))}
                options={['Connected', 'Pending', 'Failed']}
              />
              <SelectField
                label="Payout Setup Status"
                value={form.payout_setup_status}
                onChange={(v) => setForm((f) => ({ ...f, payout_setup_status: v }))}
                options={['Complete', 'Pending']}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Any additional context..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Preview + Submit */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Projected state:</span>
                <StatusBadge
                  value={computeOnboardingState(
                    form.verification_status,
                    form.api_setup_status,
                    form.payout_setup_status
                  )}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !form.company_name.trim()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating summary…
                  </>
                ) : (
                  'Submit Record'
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
            )}

            {/* Success */}
            {successFlash && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                <CheckCircle2 size={15} /> Record added successfully.
              </p>
            )}
          </form>
        </section>

        {/* Dashboard Table */}
        <section>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Onboarding Records</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {loading
                  ? 'Loading…'
                  : (() => {
                      const filtered = severityFilter === 'All'
                        ? records
                        : records.filter((r) => computeIssueSeverity(r.verification_status, r.api_setup_status, r.payout_setup_status) === severityFilter);
                      return `${filtered.length} of ${records.length} partner${records.length !== 1 ? 's' : ''}`;
                    })()}
              </p>
            </div>
            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              {(['All', 'Critical', 'Review Needed', 'Ready'] as const).map((f) => {
                const active = severityFilter === f;
                const colorMap: Record<string, string> = {
                  All: active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                  Critical: active ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50',
                  'Review Needed': active ? 'bg-orange-500 text-white' : 'text-orange-600 hover:bg-orange-50',
                  Ready: active ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:bg-emerald-50',
                };
                return (
                  <button
                    key={f}
                    onClick={() => setSeverityFilter(f as IssueSeverity | 'All')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${colorMap[f]}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                <span className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Loading records…</span>
              </div>
            ) : (() => {
                const filteredRecords = severityFilter === 'All'
                  ? records
                  : records.filter((r) => computeIssueSeverity(r.verification_status, r.api_setup_status, r.payout_setup_status) === severityFilter);
                return filteredRecords.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                <FileText size={32} strokeWidth={1.5} />
                <p className="text-sm">No records match the selected filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Verification</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">API Status</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payout</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Onboarding State</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Severity</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Owner</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Integration Health</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggested Action</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles size={12} className="text-blue-400" />
                          AI Summary
                        </span>
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRecords.map((r) => {
                      const state = computeOnboardingState(
                        r.verification_status,
                        r.api_setup_status,
                        r.payout_setup_status
                      );
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="font-medium text-gray-900">{r.company_name}</div>
                            {r.notes && (
                              <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]" title={r.notes}>
                                {r.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge value={r.verification_status} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge value={r.api_setup_status} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge value={r.payout_setup_status} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge value={state} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge value={computeIssueSeverity(r.verification_status, r.api_setup_status, r.payout_setup_status)} />
                          </td>
                          <td className="px-5 py-4 text-gray-600 text-xs whitespace-nowrap">
                            {computeReviewOwner(computeIssueSeverity(r.verification_status, r.api_setup_status, r.payout_setup_status))}
                          </td>
                          <td className="px-5 py-4">
                            <IntegrationHealthBadge value={computeIntegrationHealth(r.api_setup_status)} />
                          </td>
                          <td className="px-5 py-4 text-gray-600 text-xs max-w-[200px]">
                            {computeSuggestedAction(
                              r.verification_status,
                              r.api_setup_status,
                              r.payout_setup_status
                            )}
                          </td>
                          <td className="px-5 py-4 max-w-[260px]">
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {r.ai_summary || buildAiSummary(r.verification_status, r.api_setup_status, r.payout_setup_status)}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
            })()}
          </div>
        </section>
      </main>
    </div>
  );
}
