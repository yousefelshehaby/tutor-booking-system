-- ============================================================================
-- Personalized dashboard greetings need a display name for TAs (tutors
-- already have one via tutors.name; the super admin's greeting is a
-- fixed personal touch, not stored data).
-- ============================================================================

alter table admin_users add column name text;
