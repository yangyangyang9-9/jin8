-- 修复Supabase权限问题

-- 1. 确保authenticated角色存在
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- 2. 授予authenticated角色对public模式的所有权限
GRANT ALL ON SCHEMA public TO authenticated;

-- 3. 授予authenticated角色对现有表的所有权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;

-- 4. 授予authenticated角色对现有序列的所有权限
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. 授予authenticated角色对现有函数的所有权限
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 6. 设置未来创建的对象的默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO authenticated;

-- 7. 确保users表存在并正确设置
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. 为users表创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 9. 授予authenticated角色对users表的所有权限
GRANT ALL PRIVILEGES ON users TO authenticated;
