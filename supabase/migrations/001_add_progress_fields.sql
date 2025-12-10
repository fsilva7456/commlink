-- Migration: Add progress tracking fields to runs table
-- Run this in your Supabase SQL Editor after the initial schema

-- Add progress tracking columns
ALTER TABLE runs ADD COLUMN IF NOT EXISTS current_step text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS progress float DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS total_steps integer DEFAULT 3;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS eta_seconds integer;

-- Add comment for documentation
COMMENT ON COLUMN runs.current_step IS 'Current step: collecting, training, evaluating';
COMMENT ON COLUMN runs.progress IS 'Progress percentage 0.0 to 1.0';
COMMENT ON COLUMN runs.total_steps IS 'Total number of steps (default 3: collect, train, evaluate)';
COMMENT ON COLUMN runs.started_at IS 'When the run actually started processing';
COMMENT ON COLUMN runs.eta_seconds IS 'Estimated seconds until completion';

-- Update the realtime publication to include new columns
-- (columns are automatically included, but ensure runs table is in publication)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'runs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE runs;
    END IF;
END $$;
