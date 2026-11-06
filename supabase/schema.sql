-- ============================================================================
-- MOTO CARE - HỆ THỐNG QUẢN LÝ QUY TRÌNH THUÊ XE MÁY & SỰ CỐ (BPMN TO-BE)
-- KẾ THỪA CHUẨN KIẾN TRÚC SUPABASE CLOUD TỪ DỰ ÁN MẪU GOODBIKE
-- ============================================================================

-- Bật các extension cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. BẢNG AUDIT LOGS (Kế thừa từ GOODBIKE: Lich-su-thao-tac.sql)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    record_id VARCHAR(64) NOT NULL,
    action VARCHAR(16) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    actor_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Trigger Function ghi nhật ký kiểm toán tự động
CREATE OR REPLACE FUNCTION fn_audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id VARCHAR(64);
    v_actor_id VARCHAR(64);
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id::text;
        INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, actor_id)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(OLD), NULL, current_setting('request.jwt.claim.sub', true));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := NEW.id::text;
        INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, actor_id)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), current_setting('request.jwt.claim.sub', true));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        v_record_id := NEW.id::text;
        INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, actor_id)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, NULL, to_jsonb(NEW), current_setting('request.jwt.claim.sub', true));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. HỆ THỐNG 19 BẢNG THỰC THỂ THEO BPMN TO-BE
-- ============================================================================

-- 2.1 profiles: Hồ sơ người dùng
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(64) PRIMARY KEY, -- uuid
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(32) NOT NULL CHECK (role IN ('khach_hang', 'nhan_vien', 'quan_ly')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.1b auth_accounts: Tài khoản đăng nhập & Mật khẩu băm an toàn PBKDF2 Web Crypto
CREATE TABLE IF NOT EXISTS auth_accounts (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON auth_accounts(email);

-- 2.2 vehicles: Danh sách phương tiện (Có xe đệm ảo DUMP như GOODBIKE)
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(64) PRIMARY KEY,
    plate VARCHAR(32) NOT NULL UNIQUE,
    model VARCHAR(128) NOT NULL,
    vehicle_type VARCHAR(32) NOT NULL, -- xe_so, tay_ga, xe_con, xe_dien
    daily_price NUMERIC(12,2) NOT NULL DEFAULT 120000,
    status VARCHAR(32) NOT NULL DEFAULT 'SAN_SANG' CHECK (status IN ('SAN_SANG', 'DANG_THUE', 'BAO_TRI')),
    condition_note TEXT,
    is_dump BOOLEAN DEFAULT FALSE, -- Hàng xe đệm ảo DUMP1, DUMP2 để luân chuyển
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 rental_requests: Hồ sơ đặt thuê xe xuyên suốt 110 phần tử BPMN
CREATE TABLE IF NOT EXISTS rental_requests (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL REFERENCES profiles(id),
    vehicle_id VARCHAR(64) REFERENCES vehicles(id),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'MOI',
    total_price NUMERIC(12,2) DEFAULT 0,
    deposit_amount NUMERIC(12,2) DEFAULT 0,
    doc_request_count INT DEFAULT 0,
    closed_reason VARCHAR(128),
    returned_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_rental_dates CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_rental_customer ON rental_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_rental_vehicle ON rental_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rental_status ON rental_requests(status);
CREATE INDEX IF NOT EXISTS idx_rental_dates ON rental_requests(start_at, end_at);

-- 2.4 customer_documents: Tài liệu & kết quả AI OCR
CREATE TABLE IF NOT EXISTS customer_documents (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    doc_type VARCHAR(32) NOT NULL, -- CCCD_TRUOC, CCCD_SAU, BANG_LAI_TRUOC, BANG_LAI_SAU, OTHER
    file_url TEXT NOT NULL,
    is_valid BOOLEAN,
    check_note TEXT,
    ai_result JSONB,
    ai_confidence NUMERIC(5,4),
    ai_source VARCHAR(32) DEFAULT 'GEMINI',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 payments: Giao dịch VietQR & Ngân hàng
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL, -- DEPOSIT, EXTENSION, EXTRA, REFUND
    amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0,
    qr_ref VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ,
    provider_txn_id VARCHAR(128) UNIQUE,
    paid_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    match_result VARCHAR(16), -- DU, THIEU, SAI
    manual_verified_by VARCHAR(64) REFERENCES profiles(id),
    manual_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 contracts: Hợp đồng điện tử
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE CASCADE,
    file_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'SENT', -- SENT, SIGNED, EXPIRED
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 vehicle_schedule: Lịch điều phối & Khóa lịch xe
CREATE TABLE IF NOT EXISTS vehicle_schedule (
    id VARCHAR(64) PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    request_id VARCHAR(64) REFERENCES rental_requests(id) ON DELETE SET NULL,
    kind VARCHAR(32) NOT NULL DEFAULT 'RENTAL', -- RENTAL, MAINTENANCE
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_schedule_dates CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_vehicle ON vehicle_schedule(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_schedule_dates ON vehicle_schedule(start_at, end_at);

-- 2.8 inspections: Biên bản kiểm tra kỹ thuật (Giao / Trả / Sau trả)
CREATE TABLE IF NOT EXISTS inspections (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id),
    kind VARCHAR(32) NOT NULL, -- PRE_HANDOVER, RETURN, POST_RETURN
    attempt_no INT NOT NULL DEFAULT 1,
    inspector_id VARCHAR(64) REFERENCES profiles(id),
    checklist JSONB,
    result VARCHAR(32), -- DAT, CHUA_DAT, CAN_BAO_TRI
    photo_urls TEXT[],
    diff_items JSONB,
    rework_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (request_id, kind, attempt_no)
);

-- 2.9 handovers: Xác nhận bàn giao xe
CREATE TABLE IF NOT EXISTS handovers (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    attempt_no INT NOT NULL DEFAULT 1,
    accessories JSONB,
    staff_id VARCHAR(64) REFERENCES profiles(id),
    customer_accepted BOOLEAN DEFAULT FALSE,
    customer_note TEXT,
    handed_over_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (request_id, attempt_no)
);

-- 2.10 damage_findings: Các phát hiện hư hại sau trả xe
CREATE TABLE IF NOT EXISTS damage_findings (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    inspection_id VARCHAR(64) NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    evidence_urls TEXT[],
    estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    verified_by VARCHAR(64) REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.11 statements: Bảng kê chi tiết trả xe & Quyết toán
CREATE TABLE IF NOT EXISTS statements (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, ACCEPTED, DISPUTED
    customer_answer VARCHAR(32), -- CHAP_THUAN, KHIEU_NAI
    dispute_reason TEXT,
    resolution_note TEXT,
    resolved_by VARCHAR(64) REFERENCES profiles(id),
    sent_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.12 settlements: Bù trừ tiền cọc & Quyết toán cuối
CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL UNIQUE REFERENCES rental_requests(id) ON DELETE CASCADE,
    deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0,
    kind VARCHAR(32) NOT NULL, -- HOAN_DU, CAN_BANG, THU_THEM
    status VARCHAR(32) NOT NULL DEFAULT 'CHO', -- CHO, HOAN_TAT, CONG_NO
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.13 extension_requests: Yêu cầu gia hạn hợp đồng (SP1)
CREATE TABLE IF NOT EXISTS extension_requests (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    new_end_at TIMESTAMPTZ NOT NULL,
    eligible BOOLEAN,
    reject_reason TEXT,
    extra_fee NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'YEU_CAU',
    customer_answer VARCHAR(32),
    offer_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.14 partners: Đối tác cứu hộ & Sửa chữa ngoại tuyến
CREATE TABLE IF NOT EXISTS partners (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(128) NOT NULL,
    contact VARCHAR(64) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.15 incidents: Sự cố cứu hộ khẩn cấp (SP2 SOS)
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    reported_by VARCHAR(64) NOT NULL REFERENCES profiles(id),
    incident_code VARCHAR(64) NOT NULL UNIQUE,
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    photo_urls TEXT[],
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'MOI',
    attempt_no INT NOT NULL DEFAULT 1,
    partner_id VARCHAR(64) REFERENCES partners(id),
    escalation_note TEXT,
    actual_cost NUMERIC(12,2) DEFAULT 0,
    continue_rental BOOLEAN,
    confirmed_by VARCHAR(64) REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 2.16 incident_dispatches: Điều phối đối tác cứu hộ
CREATE TABLE IF NOT EXISTS incident_dispatches (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    partner_id VARCHAR(64) NOT NULL REFERENCES partners(id),
    attempt_no INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'SENT', -- SENT, ACCEPTED, DECLINED, TIMEOUT
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    ack_at TIMESTAMPTZ,
    result_at TIMESTAMPTZ,
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.17 maintenance_orders: Phiếu sửa chữa & bảo trì xe
CREATE TABLE IF NOT EXISTS maintenance_orders (
    id VARCHAR(64) PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    request_id VARCHAR(64) REFERENCES rental_requests(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'MO', -- MO, XONG
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.18 notifications: Thông báo đa kênh (Web, App, Email)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    request_id VARCHAR(64) REFERENCES rental_requests(id) ON DELETE CASCADE,
    template VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.19 process_events: Sổ cái sự kiện BPMN bất biến (Audit Trail 110 phần tử)
CREATE TABLE IF NOT EXISTS process_events (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
    bpmn_node_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64),
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_events_req ON process_events(request_id, created_at);

-- ============================================================================
-- 3. CÁC DATABASE TRIGGERS CỐT LÕI (KẾ THỪA TỪ DỰ ÁN MẪU GOODBIKE)
-- ============================================================================

-- TRIGGER 1: CHỐNG TRÙNG LỊCH THUÊ XE (Double-Booking Prevention)
-- Ngăn chặn hai khách hàng đặt cùng 1 xe trong cùng khoảng thời gian
CREATE OR REPLACE FUNCTION fn_prevent_double_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_conflict_count INT;
BEGIN
    -- Chỉ kiểm tra khi có gán vehicle_id và trạng thái là hợp lệ (không phải HUY hoặc TU_CHOI)
    IF NEW.vehicle_id IS NOT NULL AND NEW.status NOT IN ('DA_HUY', 'TU_CHOI', 'HOAN_TAT') THEN
        SELECT COUNT(*)
        INTO v_conflict_count
        FROM rental_requests
        WHERE vehicle_id = NEW.vehicle_id
          AND id <> NEW.id
          AND status NOT IN ('DA_HUY', 'TU_CHOI', 'HOAN_TAT')
          AND (
              (NEW.start_at, NEW.end_at) OVERLAPS (start_at, end_at)
          );

        IF v_conflict_count > 0 THEN
            RAISE EXCEPTION 'XUNG ĐỘT LỊCH: Xe % đã có khách khác đặt hoặc đang thuê trong khoảng thời gian này!', NEW.vehicle_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_double_booking ON rental_requests;
CREATE TRIGGER trg_prevent_double_booking
BEFORE INSERT OR UPDATE OF vehicle_id, start_at, end_at, status
ON rental_requests
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_double_booking();

-- TRIGGER 2: CHẶN GHI ĐÈ BẢN CŨ & TỰ ĐỘNG CẬP NHẬT updated_at (Kế thừa gb_chan_ban_cu)
CREATE OR REPLACE FUNCTION fn_check_concurrency_and_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Nếu client gửi updated_at cũ hơn server hiện tại -> cảnh báo tranh chấp đồng thời
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.updated_at IS NOT NULL AND NEW.updated_at IS NOT NULL AND NEW.updated_at < OLD.updated_at) THEN
            RAISE EXCEPTION 'TRANH CHẤP DỮ LIỆU: Bản ghi đã được cập nhật bởi phiên khác! Vui lòng tải lại trang.';
        END IF;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_concurrency_rental_requests ON rental_requests;
CREATE TRIGGER trg_concurrency_rental_requests
BEFORE UPDATE ON rental_requests
FOR EACH ROW
EXECUTE FUNCTION fn_check_concurrency_and_timestamp();

DROP TRIGGER IF EXISTS trg_concurrency_vehicles ON vehicles;
CREATE TRIGGER trg_concurrency_vehicles
BEFORE UPDATE ON vehicles
FOR EACH ROW
EXECUTE FUNCTION fn_check_concurrency_and_timestamp();

-- TRIGGER 3: GẮN AUDIT LOG TỰ ĐỘNG VÀO CÁC BẢNG TRỌNG YẾU (Kế thừa gb_ghi_lich_su)
DROP TRIGGER IF EXISTS trg_audit_rental_requests ON rental_requests;
CREATE TRIGGER trg_audit_rental_requests
AFTER INSERT OR UPDATE OR DELETE ON rental_requests
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_statements ON statements;
CREATE TRIGGER trg_audit_statements
AFTER INSERT OR UPDATE OR DELETE ON statements
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_settlements ON settlements;
CREATE TRIGGER trg_audit_settlements
AFTER INSERT OR UPDATE OR DELETE ON settlements
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();

-- ============================================================================
-- 4. KÍCH HOẠT SUPABASE REALTIME & STORAGE BUCKETS
-- ============================================================================

-- Kích hoạt publication cho Realtime WebSocket
ALTER PUBLICATION supabase_realtime ADD TABLE rental_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Tạo Storage Buckets phục vụ upload ảnh
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('documents', 'documents', true),
    ('handovers', 'handovers', true),
    ('incidents', 'incidents', true)
ON CONFLICT (id) DO NOTHING;

-- Thiết lập Row Level Security (RLS) mở quyền cho demo / dev
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc / ghi tự do cho anon và authenticated (phục vụ đồ án & FE-first)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access on %I" ON %I;', t, t);
        EXECUTE format('CREATE POLICY "Public access on %I" ON %I FOR ALL USING (true) WITH CHECK (true);', t, t);
    END LOOP;
END;
$$;
