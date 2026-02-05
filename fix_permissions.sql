-- 修复权限错误：permission denied for schema public

-- 1. 授予用户对public模式的使用权限
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. 授予用户对现有表的所有权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. 授予用户对现有序列的所有权限
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. 授予用户对未来创建的表的所有权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO authenticated;

-- 5. 授予用户对未来创建的序列的所有权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO authenticated;

-- 6. 确保用户表有password字段（如果不存在）
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password TEXT;

-- 7. 为password字段添加NOT NULL约束
ALTER TABLE IF EXISTS users ALTER COLUMN password SET NOT NULL;
