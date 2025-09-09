-- Enable real-time updates for the profiles table
-- This allows users to receive instant notifications when their role changes

-- Enable real-time for the profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Ensure the profiles table has proper indexes for real-time performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Grant necessary permissions for real-time
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- Create a function to notify users of role changes
CREATE OR REPLACE FUNCTION notify_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if role actually changed
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        PERFORM pg_notify(
            'role_change',
            json_build_object(
                'user_id', NEW.id,
                'old_role', OLD.role,
                'new_role', NEW.role,
                'timestamp', NOW()
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for role change notifications
DROP TRIGGER IF EXISTS on_role_change ON profiles;
CREATE TRIGGER on_role_change
    AFTER UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION notify_role_change();

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Real-time enabled for profiles table';
    RAISE NOTICE '✅ Role change notifications configured';
    RAISE NOTICE '';
    RAISE NOTICE 'Users will now receive instant updates when their role changes.';
END;
$$;