-- Add category and additional fields to subscription_plans for dynamic plan management
-- Category separates plans between 'clinica' and 'sindicato'

-- Create enum for plan categories
DO $$ BEGIN
    CREATE TYPE public.plan_category AS ENUM ('clinica', 'sindicato');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS category public.plan_category NOT NULL DEFAULT 'clinica',
ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS annual_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS resource_limits jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS module_flags jsonb DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.subscription_plans.category IS 'Category of the plan: clinica (for clinic modules) or sindicato (for union modules)';
COMMENT ON COLUMN public.subscription_plans.billing_period IS 'Billing period: monthly, annual, or custom';
COMMENT ON COLUMN public.subscription_plans.annual_price IS 'Annual price (if billing_period supports annual billing)';
COMMENT ON COLUMN public.subscription_plans.trial_days IS 'Number of trial days for new subscriptions';
COMMENT ON COLUMN public.subscription_plans.display_order IS 'Order for displaying plans in the UI';
COMMENT ON COLUMN public.subscription_plans.resource_limits IS 'JSON with resource limits: max_empresas, max_socios, max_negociacoes, etc.';
COMMENT ON COLUMN public.subscription_plans.module_flags IS 'JSON with module access flags: empresas, socios, contribuicoes, financeiro, negociacoes, relatorios_avancados';

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_subscription_plans_category ON public.subscription_plans(category);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_display_order ON public.subscription_plans(display_order);

-- RLS policies are already in place for subscription_plans, no changes needed