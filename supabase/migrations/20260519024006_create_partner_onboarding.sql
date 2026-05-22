/*
  # Create partner_onboarding table

  1. New Tables
    - `partner_onboarding`
      - `id` (uuid, primary key)
      - `company_name` (text, not null)
      - `verification_status` (text: Verified | Pending | Failed)
      - `api_setup_status` (text: Connected | Failed | Pending)
      - `payout_setup_status` (text: Complete | Pending)
      - `notes` (text, nullable)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `partner_onboarding` table
    - Add policy for authenticated users to select all records
    - Add policy for authenticated users to insert records
*/

CREATE TABLE IF NOT EXISTS partner_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  verification_status text NOT NULL DEFAULT 'Pending',
  api_setup_status text NOT NULL DEFAULT 'Pending',
  payout_setup_status text NOT NULL DEFAULT 'Pending',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partner_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read onboarding records"
  ON partner_onboarding FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert onboarding records"
  ON partner_onboarding FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow anon read for ops dashboard"
  ON partner_onboarding FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert for ops dashboard"
  ON partner_onboarding FOR INSERT
  TO anon
  WITH CHECK (true);
