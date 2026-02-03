import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';

// 登录
export const login = async (username, password) => {
  try {
    console.log('开始登录流程:', username);
    // 清理用户名
    const cleanedUsername = username.replace(/[^a-zA-Z0-9_]/g, '');
    const limitedUsername = cleanedUsername.substring(0, 30);
    const validUsername = limitedUsername || 'user';

    // 直接从数据库中查找用户
    console.log('从数据库中查找用户:', validUsername);
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', validUsername);

    if (userError) {
      console.error('查找用户失败:', userError);
      return {
        success: false,
        message: '登录失败，请稍后再试'
      };
    }

    if (!users || users.length === 0) {
      console.log('用户不存在:', validUsername);
      return {
        success: false,
        message: '用户名或密码错误'
      };
    }

    const user = users[0];
    console.log('找到用户:', user.id);

    // 检查并禁用过期的生产线
    await checkAndDisableExpiredLines();

    // 生成临时认证令牌
    const generateId = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const authToken = generateId();

    // 存储认证信息
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, authToken);
    await SecureStore.setItemAsync(USER_ID_KEY, user.id);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name || user.username
      }
    };
  } catch (error) {
    console.error('登录函数的错误:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// 注册
export const register = async (username, password) => {
  try {
    console.log('开始注册流程:', username);
    // 清理用户名，确保生成的邮箱有效
    const cleanedUsername = username.replace(/[^a-zA-Z0-9_]/g, '');
    const limitedUsername = cleanedUsername.substring(0, 30);
    const validUsername = limitedUsername || 'user';
    
    // 检查用户名是否已存在
    console.log('检查用户名是否已存在:', validUsername);
    const { data: existingUsers, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('username', validUsername);

    if (userCheckError) {
      console.error('检查用户名失败:', userCheckError);
      return {
        success: false,
        message: '检查用户名失败，请稍后再试'
      };
    } else if (existingUsers && existingUsers.length > 0) {
      console.log('用户名已存在:', validUsername);
      return {
        success: false,
        message: '用户名已被注册，请尝试使用其他用户名'
      };
    }

    // 额外检查：确保用户名不为空且符合要求
    if (!validUsername || validUsername.trim() === '') {
      return {
        success: false,
        message: '用户名不能为空'
      };
    }

    // 检查用户名长度
    if (validUsername.length < 2) {
      return {
        success: false,
        message: '用户名长度不能少于2个字符'
      };
    }

    // 生成唯一ID
    const generateId = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    // 生成用户ID
    const userId = generateId();
    
    // 自动配置邮箱后缀，使用更复杂的随机字符串以避免冲突
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const email = `${validUsername}_${timestamp}_${randomString}@${timestamp}.com`;
    console.log('生成的邮箱:', email);

    // 直接在数据库中创建用户记录，不使用Supabase Auth
    console.log('创建用户记录:', userId);
    const { error: createUserError } = await supabase
      .from('users')
      .insert({
        id: userId,
        username: validUsername,
        email: email,
        name: username
      });

    if (createUserError) {
      console.error('创建用户记录失败:', createUserError);
      return {
        success: false,
        message: '创建用户记录失败，请稍后再试'
      };
    }

    // 为新用户创建一条免费使用30天的生产线
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    console.log('创建免费生产线:', userId);
    const { data: lineData, error: createLineError } = await supabase
      .from('production_lines')
      .insert({
        name: `${username}的免费生产线`,
        owner_id: userId,
        plan: '赠送',
        price: 0.00,
        expire_date: expireDate,
        status: '启用',
        is_active: true
      })
      .select('id');

    if (createLineError) {
      console.error('创建生产线失败:', createLineError);
      return {
        success: false,
        message: '创建生产线失败，请稍后再试'
      };
    }

    // 将用户添加为生产线成员（金主角色）
    if (lineData && lineData.length > 0) {
      console.log('添加生产线成员:', userId, lineData[0].id);
      const { error: addMemberError } = await supabase
        .from('production_line_members')
        .insert({
          line_id: lineData[0].id,
          user_id: userId,
          role: '金主'
        });

      if (addMemberError) {
        console.error('添加生产线成员失败:', addMemberError);
        // 继续执行，不因为添加成员失败而中断注册流程
      }
    }

    // 生成临时认证令牌
    const authToken = generateId();

    // 存储认证信息
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, authToken);
    await SecureStore.setItemAsync(USER_ID_KEY, userId);

    console.log('注册流程完成:', userId);
    return {
      success: true,
      user: {
        id: userId,
        username: validUsername,
        email: email,
        name: username
      }
    };
  } catch (error) {
    console.error('注册函数的错误:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// 登出
export const logout = async () => {
  try {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ID_KEY);
  } catch (error) {
    console.error('登出失败:', error);
  }
};

// 获取当前用户ID
export const getCurrentUserId = async () => {
  return await SecureStore.getItemAsync(USER_ID_KEY);
};

// 检查是否已登录
export const isAuthenticated = async () => {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  return !!token;
};

// 获取当前用户信息
export const getCurrentUser = async () => {
  try {
    const userId = await SecureStore.getItemAsync(USER_ID_KEY);
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('获取用户信息失败:', error);
        return null;
      }

      // 确保返回的用户对象包含必要的属性
      return {
        ...data,
        name: data.name || data.username || '未知用户'
      };
    }
    return null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

// 获取用户的生产线
export const getUserProductionLines = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('production_lines')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('获取生产线失败:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('获取生产线失败:', error);
    return [];
  }
};

// 获取生产线成员
export const getProductionLineMembers = async (lineId) => {
  try {
    const { data, error } = await supabase
      .from('production_line_members')
      .select('*')
      .eq('line_id', lineId);

    if (error) {
      console.error('获取生产线成员失败:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('获取生产线成员失败:', error);
    return [];
  }
};

// 检查并禁用过期的生产线
export const checkAndDisableExpiredLines = async () => {
  try {
    const now = new Date().toISOString();
    
    // 查找所有过期且状态为启用的生产线
    const { data: expiredLines, error: fetchError } = await supabase
      .from('production_lines')
      .select('id')
      .lt('expire_date', now)
      .eq('status', '启用')
      .eq('is_active', true);

    if (fetchError) {
      console.error('获取过期生产线失败:', fetchError);
      return;
    }

    // 禁用过期的生产线
    if (expiredLines && expiredLines.length > 0) {
      for (const line of expiredLines) {
        await supabase
          .from('production_lines')
          .update({ status: '停用' })
          .eq('id', line.id);
      }
    }
  } catch (error) {
    console.error('检查过期生产线失败:', error);
  }
};
