-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建生产线表
CREATE TABLE IF NOT EXISTS production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  plan TEXT NOT NULL CHECK (plan IN ('月付', '年付', '赠送')),
  price DECIMAL(10, 2) NOT NULL,
  expire_date TIMESTAMP NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('启用', '停用', '冻结')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建生产线成员表
CREATE TABLE IF NOT EXISTS production_line_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('金主', '线长', '班长')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(line_id, user_id)
);

-- 创建生产记录表
CREATE TABLE IF NOT EXISTS production_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES production_lines(id),
  user_id UUID NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL,
  photo_path TEXT,         -- 图片在 storage 中的路径
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建财务记录表
CREATE TABLE IF NOT EXISTS financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(id),
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('收入', '支出')),
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_production_lines_owner_id ON production_lines(owner_id);
CREATE INDEX IF NOT EXISTS idx_production_lines_is_active ON production_lines(is_active);
CREATE INDEX IF NOT EXISTS idx_production_line_members_line_id ON production_line_members(line_id);
CREATE INDEX IF NOT EXISTS idx_production_line_members_user_id ON production_line_members(user_id);
CREATE INDEX IF NOT EXISTS idx_production_records_line_id ON production_records(line_id);
CREATE INDEX IF NOT EXISTS idx_production_records_date ON production_records(date);
CREATE INDEX IF NOT EXISTS idx_financial_records_line_id ON financial_records(line_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_date ON financial_records(date);
CREATE INDEX IF NOT EXISTS idx_financial_records_type ON financial_records(type);

-- 插入示例数据
-- 注意：在实际使用中，用户数据会通过Supabase Auth自动创建
-- 这里仅作为示例

-- 插入示例用户
-- INSERT INTO users (id, email, name, role) VALUES
-- ('123e4567-e89b-12d3-a456-426614174000', 'admin@example.com', '管理员', '金主'),
-- ('123e4567-e89b-12d3-a456-426614174001', 'user1@example.com', '用户1', '线长'),
-- ('123e4567-e89b-12d3-a456-426614174002', 'user2@example.com', '用户2', '班长');

-- 插入示例生产线
-- INSERT INTO production_lines (id, name, owner_id, plan, price, expire_date, status, is_active) VALUES
-- ('123e4567-e89b-12d3-a456-426614174003', '黄金生产线A', '123e4567-e89b-12d3-a456-426614174000', '年付', 5999.00, NOW() + INTERVAL '1 year', '启用', true),
-- ('123e4567-e89b-12d3-a456-426614174004', '黄金生产线B', '123e4567-e89b-12d3-a456-426614174000', '月付', 599.00, NOW() + INTERVAL '1 month', '启用', true);

-- 插入示例生产线成员
-- INSERT INTO production_line_members (line_id, user_id, role) VALUES
-- ('123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174000', '金主'),
-- ('123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174001', '线长'),
-- ('123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174002', '班长'),
-- ('123e4567-e89b-12d3-a456-426614174004', '123e4567-e89b-12d3-a456-426614174000', '金主'),
-- ('123e4567-e89b-12d3-a456-426614174004', '123e4567-e89b-12d3-a456-426614174001', '线长');
