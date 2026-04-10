-- migrations/2026_04_06_supplier_city.sql
-- Add city column to suppliers for geographic search

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS city TEXT;
