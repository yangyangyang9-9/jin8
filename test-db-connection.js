const { createClient } = require('@supabase/supabase-js');

// 使用用户提供的数据库配置
const supabaseUrl = 'https://yogdjoisougtrgsuonbq.supabase.co';
const supabaseKey = 'sb_publishable_eAgMSHqxVldtqAK3A2hRRg_zKR_4qR5';

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// 测试数据库连接
async function testDatabaseConnection() {
  console.log('开始测试数据库连接...');
  try {
    // 尝试获取用户表信息
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .limit(5);

    if (error) {
      console.error('数据库连接测试失败:', error);
      return false;
    } else {
      console.log('数据库连接测试成功!');
      console.log('获取到的用户数据:', data);
      return true;
    }
  } catch (error) {
    console.error('数据库连接测试异常:', error);
    return false;
  }
}

// 运行测试
testDatabaseConnection();
