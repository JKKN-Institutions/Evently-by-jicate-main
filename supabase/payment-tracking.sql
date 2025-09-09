-- Create payments table to track all payment attempts
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    payment_method TEXT,
    error_code TEXT,
    error_description TEXT,
    error_source TEXT,
    error_step TEXT,
    error_reason TEXT,
    attempts INTEGER DEFAULT 0,
    notes JSONB,
    metadata JSONB
);

-- Create payment status enum for better tracking
ALTER TABLE payments 
ADD CONSTRAINT payment_status_check 
CHECK (status IN (
    'created',           -- Order created, payment not started
    'authorized',        -- Payment authorized but not captured
    'captured',          -- Payment successfully captured
    'failed',            -- Payment failed
    'pending',           -- Payment pending (for certain methods)
    'refund_initiated',  -- Refund process started
    'refunded',          -- Refund completed
    'partially_refunded' -- Partial refund completed
));

-- Create indexes for performance
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Create payment logs table for detailed tracking
CREATE TABLE payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB,
    ip_address TEXT,
    user_agent TEXT
);

-- Create index for payment logs
CREATE INDEX idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX idx_payment_logs_booking_id ON payment_logs(booking_id);
CREATE INDEX idx_payment_logs_created_at ON payment_logs(created_at);

-- Update trigger for payments updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update booking payment status based on payment status
CREATE OR REPLACE FUNCTION update_booking_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update booking payment status when payment status changes
    IF NEW.status = 'captured' THEN
        UPDATE bookings 
        SET payment_status = 'completed',
            payment_id = NEW.razorpay_payment_id
        WHERE id = NEW.booking_id;
    ELSIF NEW.status = 'failed' THEN
        UPDATE bookings 
        SET payment_status = 'failed'
        WHERE id = NEW.booking_id;
    ELSIF NEW.status IN ('refunded', 'partially_refunded') THEN
        UPDATE bookings 
        SET payment_status = 'refunded'
        WHERE id = NEW.booking_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update booking status
CREATE TRIGGER update_booking_on_payment_change
    AFTER UPDATE OF status ON payments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_booking_payment_status();

-- RLS Policies for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Only system can insert/update payments (through service role)
CREATE POLICY "Service role can manage payments" ON payments
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for payment_logs
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their payments
CREATE POLICY "Users can view own payment logs" ON payment_logs
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Service role can manage payment logs
CREATE POLICY "Service role can manage payment logs" ON payment_logs
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');
