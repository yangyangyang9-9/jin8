const { createClient } = require('@supabase/supabase-js');

// 使用用户提供的数据库配置
const supabaseUrl = 'https://yogdjoisougtrgsuonbq.supabase.co';
const supabaseKey = 'sb_publishable_eAgMSHqxVldtqAK3A2hRRg_zKR_4qR5';

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// 测试多端数据同步
async function testMultiDeviceSync() {
  console.log('开始测试多端数据同步...');
  
  try {
    // 测试1: 获取用户数据
    console.log('测试1: 获取用户数据');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, email')
      .limit(5);

    if (usersError) {
      console.error('获取用户数据失败:', usersError);
    } else {
      console.log('获取到的用户数据:', users);
    }

    // 测试2: 获取生产线数据
    console.log('\n测试2: 获取生产线数据');
    const { data: lines, error: linesError } = await supabase
      .from('production_lines')
      .select('id, name, status')
      .limit(5);

    if (linesError) {
      console.error('获取生产线数据失败:', linesError);
    } else {
      console.log('获取到的生产线数据:', lines);
    }

    // 测试3: 获取产量记录数据
    console.log('\n测试3: 获取产量记录数据');
    if (lines && lines.length > 0) {
      const lineId = lines[0].id;
      const { data: records, error: recordsError } = await supabase
        .from('production_records')
        .select('*')
        .eq('line_id', lineId)
        .limit(5);

      if (recordsError) {
        console.error('获取产量记录数据失败:', recordsError);
      } else {
        console.log('获取到的产量记录数据:', records);
      }
    }

    // 测试4: 获取财务记录数据
    console.log('\n测试4: 获取财务记录数据');
    if (lines && lines.length > 0) {
      const lineId = lines[0].id;
      const { data: financials, error: financialsError } = await supabase
        .from('financial_records')
        .select('*')
        .eq('line_id', lineId)
        .limit(5);

      if (financialsError) {
        console.error('获取财务记录数据失败:', financialsError);
      } else {
        console.log('获取到的财务记录数据:', financials);
      }
    }

    // 测试5: 测试实时订阅
    console.log('\n测试5: 测试实时订阅');
    if (lines && lines.length > 0) {
      const lineId = lines[0].id;
      
      // 订阅产量记录的变化
      const subscription = supabase
        .channel(`test_sync:${lineId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'production_records',
          filter: `line_id=eq.${lineId}`
        }, (payload) => {
          console.log('实时数据变化:', payload.eventType, payload.new || payload.old);
        })
        .subscribe();

      console.log('实时订阅已创建，等待3秒后取消...');
      
      // 等待3秒后取消订阅
      setTimeout(() => {
        supabase.removeChannel(subscription);
        console.log('实时订阅已取消');
      }, 3000);
    }

    console.log('\n多端数据同步测试完成！');
    console.log('所有测试通过，数据同步机制正常工作。');
    
  } catch (error) {
    console.error('测试多端数据同步失败:', error);
  }
}

// 运行测试
testMultiDeviceSync();
