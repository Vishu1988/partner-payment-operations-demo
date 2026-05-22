import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type VerificationStatus = 'Verified' | 'Pending' | 'Failed';
export type ApiSetupStatus = 'Connected' | 'Failed' | 'Pending';
export type PayoutSetupStatus = 'Complete' | 'Pending';
export type OnboardingState = 'Ready for Activation' | 'Pending Review';
export type IssueSeverity = 'Critical' | 'Review Needed' | 'Ready';
export type IntegrationHealth = 'Healthy' | 'Degraded' | 'Failed';

export function computeReviewOwner(severity: IssueSeverity): string {
  if (severity === 'Critical') return 'Payments Ops Team';
  if (severity === 'Review Needed') return 'Merchant Onboarding Queue';
  return 'Auto Approved';
}

export function computeIntegrationHealth(apiSetupStatus: ApiSetupStatus): IntegrationHealth {
  if (apiSetupStatus === 'Failed') return 'Failed';
  if (apiSetupStatus === 'Pending') return 'Degraded';
  return 'Healthy';
}

export function computeIssueSeverity(
  verificationStatus: VerificationStatus,
  apiSetupStatus: ApiSetupStatus,
  payoutSetupStatus: PayoutSetupStatus
): IssueSeverity {
  if (verificationStatus === 'Failed' || apiSetupStatus === 'Failed') return 'Critical';
  if (verificationStatus === 'Pending' || apiSetupStatus === 'Pending' || payoutSetupStatus === 'Pending') return 'Review Needed';
  return 'Ready';
}

export interface PartnerOnboarding {
  id: string;
  company_name: string;
  verification_status: VerificationStatus;
  api_setup_status: ApiSetupStatus;
  payout_setup_status: PayoutSetupStatus;
  notes: string;
  ai_summary: string;
  created_at: string;
}

export function buildAiSummary(
  verificationStatus: VerificationStatus,
  apiSetupStatus: ApiSetupStatus,
  payoutSetupStatus: PayoutSetupStatus
): string {
  const parts: string[] = [];
  if (apiSetupStatus === 'Failed') parts.push('API integration failed');
  if (verificationStatus === 'Pending') parts.push('verification is pending');
  if (payoutSetupStatus === 'Pending') parts.push('payout setup is incomplete');

  if (parts.length === 0) return 'Ready for activation.';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.';

  const allButLast = parts.slice(0, -1);
  const last = parts[parts.length - 1];
  return (
    allButLast.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(', ') +
    ', and ' +
    last +
    '.'
  );
}

export function computeSuggestedAction(
  verificationStatus: VerificationStatus,
  apiSetupStatus: ApiSetupStatus,
  payoutSetupStatus: PayoutSetupStatus
): string {
  if (apiSetupStatus === 'Failed') return 'Regenerate API credentials and retry onboarding';
  if (verificationStatus === 'Pending') return 'Complete verification review';
  if (payoutSetupStatus === 'Pending') return 'Verify payout account setup';
  return 'Ready for activation';
}

export function computeOnboardingState(
  verificationStatus: VerificationStatus,
  apiSetupStatus: ApiSetupStatus,
  payoutSetupStatus: PayoutSetupStatus
): OnboardingState {
  const hasPendingOrFailed =
    verificationStatus !== 'Verified' ||
    apiSetupStatus !== 'Connected' ||
    payoutSetupStatus !== 'Complete';
  return hasPendingOrFailed ? 'Pending Review' : 'Ready for Activation';
}
