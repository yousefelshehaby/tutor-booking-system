-- ============================================================================
-- Renames the bootstrap tutor seeded in 0005 (name "المدرّس الافتراضي",
-- slug "default") to the real tutor's name/slug. Safe to run on the
-- existing database (already renamed there directly) — this exists so a
-- FRESH database built from these migrations from scratch also ends up
-- with the correct name/slug instead of the placeholder.
-- ============================================================================

update tutors
set name = 'يوسف الشحابي', slug = 'yousef'
where slug = 'default';
