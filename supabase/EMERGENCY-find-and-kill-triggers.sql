-- =====================================================
-- EMERGENCY: FIND AND DESTROY ALL ROLE-INTERFERING CODE
-- =====================================================

-- Step 1: Show ALL triggers on auth.users table
DO $$
DECLARE
    trigger_rec RECORD;
    function_rec RECORD;
BEGIN
    RAISE NOTICE '=== ALL TRIGGERS ON auth.users ===';
    
    FOR trigger_rec IN 
        SELECT 
            tgname as trigger_name,
            p.proname as function_name,
            pg_get_triggerdef(t.oid) as trigger_definition
        FROM pg_trigger t
        LEFT JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgrelid = 'auth.users'::regclass 
        AND t.tgisinternal = false
    LOOP
        RAISE NOTICE 'TRIGGER: % -> FUNCTION: %', trigger_rec.trigger_name, trigger_rec.function_name;
        RAISE NOTICE 'DEFINITION: %', trigger_rec.trigger_definition;
        RAISE NOTICE '---';
        
        -- Drop each trigger
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE', trigger_rec.trigger_name);
        RAISE NOTICE '✅ DROPPED TRIGGER: %', trigger_rec.trigger_name;
    END LOOP;
    
    RAISE NOTICE '=== ALL FUNCTIONS THAT MIGHT AFFECT PROFILES ===';
    
    -- Find and drop functions that might affect profiles
    FOR function_rec IN 
        SELECT proname, prosrc
        FROM pg_proc 
        WHERE (
            prosrc ILIKE '%profiles%' 
            OR prosrc ILIKE '%role%'
            OR proname ILIKE '%user%'
            OR proname ILIKE '%profile%'
        )
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        RAISE NOTICE 'FUNCTION: % - SOURCE: %', function_rec.proname, LEFT(function_rec.prosrc, 100);
        
        -- Drop functions that might be interfering
        IF function_rec.proname ILIKE '%handle%user%' OR 
           function_rec.proname ILIKE '%sync%' OR
           function_rec.proname ILIKE '%update%role%' THEN
            EXECUTE format('DROP FUNCTION IF EXISTS %I() CASCADE', function_rec.proname);
            RAISE NOTICE '✅ DROPPED FUNCTION: %', function_rec.proname;
        END IF;
    END LOOP;
END $$;

-- Step 2: Show all RLS policies on profiles table
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    RAISE NOTICE '=== RLS POLICIES ON PROFILES TABLE ===';
    
    FOR policy_rec IN 
        SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as policy_expression
        FROM pg_policy 
        WHERE polrelid = 'public.profiles'::regclass
    LOOP
        RAISE NOTICE 'POLICY: % (%) - EXPRESSION: %', 
                     policy_rec.polname, 
                     policy_rec.polcmd, 
                     policy_rec.policy_expression;
    END LOOP;
END $$;

-- Step 3: Check for any Edge Functions or Webhooks in pg_cron (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job' AND table_schema = 'cron') THEN
        RAISE NOTICE '=== CRON JOBS ===';
        PERFORM jobname, command FROM cron.job;
    ELSE
        RAISE NOTICE 'No cron extension found';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not check cron jobs: %', SQLERRM;
END $$;

-- Step 4: Force update the user role again
UPDATE profiles 
SET role = 'admin', updated_at = NOW() 
WHERE email = 'rojasundharam2000@gmail.com';

-- Step 5: Check the current state
DO $$
DECLARE
    current_role TEXT;
    trigger_count INTEGER;
BEGIN
    -- Check current role
    SELECT role INTO current_role 
    FROM profiles 
    WHERE email = 'rojasundharam2000@gmail.com';
    
    -- Count remaining triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass 
    AND tgisinternal = false;
    
    RAISE NOTICE '=== FINAL STATUS ===';
    RAISE NOTICE 'Current role for rojasundharam2000@gmail.com: %', current_role;
    RAISE NOTICE 'Remaining triggers on auth.users: %', trigger_count;
    
    IF trigger_count = 0 AND current_role = 'admin' THEN
        RAISE NOTICE '🎉 SUCCESS: All triggers removed, role set to admin';
    ELSE
        RAISE NOTICE '⚠️  ISSUE: Either triggers remain or role not admin';
    END IF;
END $$;