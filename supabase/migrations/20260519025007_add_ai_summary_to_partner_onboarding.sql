/*
  # Add ai_summary column to partner_onboarding

  1. Modified Tables
    - `partner_onboarding`
      - Added `ai_summary` (text, nullable) — stores the AI-generated operational summary for each record
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_onboarding' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE partner_onboarding ADD COLUMN ai_summary text DEFAULT '';
  END IF;
END $$;
