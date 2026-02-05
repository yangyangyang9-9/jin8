import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

const SESSION_KEY = 'session';
const OFFLINE_DATA_KEY = 'offline_data';
const PENDING_ACTIONS_KEY = 'pending_actions';

// 登录
export const login = async (username, password) => {
  try {
    console.log('开始登录流程:', username);
    
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    console.log('网络状态:', netInfo.isConnected);
    
    if (!netInfo.isConnected) {
      // 离线状态：检查是否有历史登录
      const session = await SecureStore.getItemAsync(SESSION_KEY);
      if (session) {
        console.log('离线登录成功');
        const sessionData = JSON.parse(session);
        return {
          success: true,
          user: {
            id: sessionData.userId,
            username: sessionData.username,
            email: sessionData.email,
            name: sessionData.name
          },
          offline: true
        };
      } else {
        console.log('离线且无历史登录');
        return {
          success: false,
          message: '请先在线登录一次'
        };
      }
    }
    
    // 在线状态：清理用户名
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
    
    // 验证密码
    if (!user.password || user.password !== password) {
      console.log('密码错误');
      return {
        success: false,
        message: '用户名或密码错误'
      };
    }

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

    const accessToken = generateId();
    const refreshToken = generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 存储会话信息
    const session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name || user.username,
      accessToken,
      refreshToken,
      expiresAt,
      lastLogin: new Date().toISOString() // 添加最后登录时间
    };
    
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    console.log('登录成功，会话已存储');

    // 同步离线数据
    await syncPendingActions();

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name || user.username
      },
      offline: false
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
    
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    console.log('网络状态:', netInfo.isConnected);
    
    if (!netInfo.isConnected) {
      // 离线状态：注册需要在线
      console.log('离线状态，无法注册');
      return {
        success: false,
        message: '注册需要网络连接'
      };
    }
    
    // 在线状态：清理用户名，确保生成的邮箱有效
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
        name: username,
        password: password
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

    // 生成认证令牌
    const accessToken = generateId();
    const refreshToken = generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 存储会话信息
    const session = {
      userId,
      username: validUsername,
      email,
      name: username,
      accessToken,
      refreshToken,
      expiresAt
    };
    
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    console.log('注册流程完成:', userId);
    return {
      success: true,
      user: {
        id: userId,
        username: validUsername,
        email,
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
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(OFFLINE_DATA_KEY);
    await SecureStore.deleteItemAsync(PENDING_ACTIONS_KEY);
    console.log('登出成功');
  } catch (error) {
    console.error('登出失败:', error);
  }
};

// 获取当前用户ID
export const getCurrentUserId = async () => {
  try {
    const session = await SecureStore.getItemAsync(SESSION_KEY);
    if (session) {
      const sessionData = JSON.parse(session);
      return sessionData.userId;
    }
    return null;
  } catch (error) {
    console.error('获取用户ID失败:', error);
    return null;
  }
};

// 检查是否已登录
export const isAuthenticated = async () => {
  try {
    const session = await SecureStore.getItemAsync(SESSION_KEY);
    if (session) {
      const sessionData = JSON.parse(session);
      // 检查登录是否在39天内
      if (sessionData.lastLogin) {
        const lastLogin = new Date(sessionData.lastLogin);
        const now = new Date();
        const daysSinceLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);
        return daysSinceLogin <= 39;
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('检查登录状态失败:', error);
    return false;
  }
};

// 自动登录
export const autoLogin = async () => {
  try {
    const session = await SecureStore.getItemAsync(SESSION_KEY);
    if (session) {
      const sessionData = JSON.parse(session);
      // 检查登录是否在39天内
      if (sessionData.lastLogin) {
        const lastLogin = new Date(sessionData.lastLogin);
        const now = new Date();
        const daysSinceLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);
        if (daysSinceLogin > 39) {
          return {
            success: false,
            message: '登录已过期，请重新登录'
          };
        }
      }
      // 更新最后登录时间
      sessionData.lastLogin = new Date().toISOString();
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sessionData));
      return {
        success: true,
        user: {
          id: sessionData.userId,
          username: sessionData.username,
          email: sessionData.email,
          name: sessionData.name
        },
        offline: false
      };
    }
    return {
      success: false,
      message: '请先登录'
    };
  } catch (error) {
    console.error('自动登录失败:', error);
    return {
      success: false,
      message: '自动登录失败'
    };
  }
};

// 获取当前用户信息
export const getCurrentUser = async () => {
  try {
    const session = await SecureStore.getItemAsync(SESSION_KEY);
    if (session) {
      const sessionData = JSON.parse(session);
      
      // 检查网络状态
      const netInfo = await NetInfo.fetch();
      
      if (netInfo.isConnected) {
        // 在线状态：从服务器获取最新信息
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionData.userId)
          .single();

        if (error) {
          console.error('获取用户信息失败:', error);
          // 失败时返回缓存的信息
          return {
            id: sessionData.userId,
            username: sessionData.username,
            email: sessionData.email,
            name: sessionData.name
          };
        }

        // 更新缓存
        sessionData.username = data.username;
        sessionData.email = data.email;
        sessionData.name = data.name || data.username;
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sessionData));

        return {
          ...data,
          name: data.name || data.username || '未知用户'
        };
      } else {
        // 离线状态：返回缓存的信息
        return {
          id: sessionData.userId,
          username: sessionData.username,
          email: sessionData.email,
          name: sessionData.name
        };
      }
    }
    return null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

// 获取用户的生产线（包括拥有的和加入的）
export const getUserProductionLines = async (userId) => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (netInfo.isConnected) {
      // 在线状态：从服务器获取
      
      // 1. 查询用户拥有的生产线
      const { data: ownedLines, error: ownedError } = await supabase
        .from('production_lines')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_active', true);

      if (ownedError) {
        console.error('获取拥有的生产线失败:', ownedError);
        // 继续执行，尝试获取加入的生产线
      }

      // 2. 查询用户作为成员加入的生产线
      const { data: memberLinesData, error: memberError } = await supabase
        .from('production_line_members')
        .select('production_lines(*),role')
        .eq('user_id', userId);

      if (memberError) {
        console.error('获取加入的生产线失败:', memberError);
        // 继续执行，返回拥有的生产线
      }

      // 处理加入的生产线数据
      const joinedLines = memberLinesData ? memberLinesData
        .map(member => ({
          ...member.production_lines,
          memberRole: member.role // 添加成员角色信息
        }))
        .filter(line => line && line.is_active) : [];

      // 合并并去重生产线
      const allLines = [];
      const lineIds = new Set();

      // 添加拥有的生产线
      if (ownedLines) {
        ownedLines.forEach(line => {
          if (!lineIds.has(line.id)) {
            lineIds.add(line.id);
            allLines.push({
              ...line,
              memberRole: '金主' // 标记为所有者（金主）
            });
          }
        });
      }

      // 添加加入的生产线
      joinedLines.forEach(line => {
        if (!lineIds.has(line.id)) {
          lineIds.add(line.id);
          allLines.push(line);
        }
      });

      if (allLines.length === 0 && (ownedError || memberError)) {
        console.error('获取生产线失败');
        // 失败时返回缓存的数据
        return await getOfflineData('production_lines', []);
      }

      // 更新缓存
      await setOfflineData('production_lines', allLines);
      return allLines;
    } else {
      // 离线状态：返回缓存的数据
      return await getOfflineData('production_lines', []);
    }
  } catch (error) {
    console.error('获取生产线失败:', error);
    return await getOfflineData('production_lines', []);
  }
};

// 获取生产线成员
export const getProductionLineMembers = async (lineId) => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (netInfo.isConnected) {
      // 在线状态：从服务器获取
      const { data, error } = await supabase
        .from('production_line_members')
        .select('*')
        .eq('line_id', lineId);

      if (error) {
        console.error('获取生产线成员失败:', error);
        // 失败时返回缓存的数据
        return await getOfflineData(`line_members_${lineId}`, []);
      }

      // 更新缓存
      await setOfflineData(`line_members_${lineId}`, data);
      return data;
    } else {
      // 离线状态：返回缓存的数据
      return await getOfflineData(`line_members_${lineId}`, []);
    }
  } catch (error) {
    console.error('获取生产线成员失败:', error);
    return await getOfflineData(`line_members_${lineId}`, []);
  }
};

// 检查并禁用过期的生产线
export const checkAndDisableExpiredLines = async () => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      // 离线状态：跳过
      console.log('离线状态，跳过检查过期生产线');
      return;
    }
    
    // 在线状态：执行检查
    const now = new Date().toISOString();
    
    // 1. 查找所有过期且状态为启用的生产线，设置为停用
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

    // 2. 查找所有未过期但状态不是启用的生产线，设置为启用
    const { data: validLines, error: validLinesError } = await supabase
      .from('production_lines')
      .select('id')
      .gte('expire_date', now)
      .neq('status', '启用')
      .eq('is_active', true);

    if (validLinesError) {
      console.error('获取未过期生产线失败:', validLinesError);
      return;
    }

    // 启用未过期的生产线
    if (validLines && validLines.length > 0) {
      for (const line of validLines) {
        await supabase
          .from('production_lines')
          .update({ status: '启用' })
          .eq('id', line.id);
      }
    }

    console.log('生产线状态检查完成');
  } catch (error) {
    console.error('检查过期生产线失败:', error);
  }
};

// 获取离线数据
export const getOfflineData = async (key, defaultValue = null) => {
  try {
    const offlineData = await SecureStore.getItemAsync(OFFLINE_DATA_KEY);
    if (offlineData) {
      const data = JSON.parse(offlineData);
      return data[key] || defaultValue;
    }
    return defaultValue;
  } catch (error) {
    console.error('获取离线数据失败:', error);
    return defaultValue;
  }
};

// 设置离线数据
export const setOfflineData = async (key, value) => {
  try {
    const offlineData = await SecureStore.getItemAsync(OFFLINE_DATA_KEY);
    const data = offlineData ? JSON.parse(offlineData) : {};
    data[key] = value;
    await SecureStore.setItemAsync(OFFLINE_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('设置离线数据失败:', error);
  }
};

// 添加待处理的离线操作
export const addPendingAction = async (type, payload) => {
  try {
    const pendingActions = await SecureStore.getItemAsync(PENDING_ACTIONS_KEY);
    const actions = pendingActions ? JSON.parse(pendingActions) : [];
    
    const action = {
      id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      }),
      type,
      payload,
      createdAt: new Date().toISOString(),
      synced: false
    };
    
    actions.push(action);
    await SecureStore.setItemAsync(PENDING_ACTIONS_KEY, JSON.stringify(actions));
    return action;
  } catch (error) {
    console.error('添加待处理操作失败:', error);
    return null;
  }
};

// 获取待处理的离线操作
export const getPendingActions = async () => {
  try {
    const pendingActions = await SecureStore.getItemAsync(PENDING_ACTIONS_KEY);
    return pendingActions ? JSON.parse(pendingActions) : [];
  } catch (error) {
    console.error('获取待处理操作失败:', error);
    return [];
  }
};

// 同步待处理的离线操作到服务器
export const syncPendingActions = async () => {
  try {
    const pendingActions = await getPendingActions();
    const actionsToSync = pendingActions.filter(action => !action.synced);
    
    if (actionsToSync.length === 0) {
      console.log('没有待同步的操作');
      return;
    }
    
    console.log('开始同步待处理操作:', actionsToSync.length);
    
    // 按顺序同步操作
    for (const action of actionsToSync) {
      try {
        console.log('同步操作:', action.type);
        
        // 根据操作类型执行不同的同步逻辑
        switch (action.type) {
          case 'CREATE_PRODUCTION_RECORD':
            // 同步生产记录
            await supabase
              .from('production_records')
              .insert(action.payload);
            break;
          case 'UPDATE_PRODUCTION_LINE':
            // 同步生产线更新
            await supabase
              .from('production_lines')
              .update(action.payload.data)
              .eq('id', action.payload.lineId);
            break;
          // 可以添加更多操作类型
          default:
            console.log('未知操作类型:', action.type);
        }
        
        // 标记操作为已同步
        action.synced = true;
      } catch (syncError) {
        console.error('同步操作失败:', syncError);
        // 继续同步其他操作
      }
    }
    
    // 更新待处理操作列表
    await SecureStore.setItemAsync(PENDING_ACTIONS_KEY, JSON.stringify(pendingActions));
    console.log('同步完成');
  } catch (error) {
    console.error('同步待处理操作失败:', error);
  }
};

// 进入离线模式
export const enterOfflineMode = async (session) => {
  try {
    console.log('进入离线模式:', session.userId);
    // 可以在这里初始化离线模式的状态
    // 例如：加载缓存数据、设置离线标志等
  } catch (error) {
    console.error('进入离线模式失败:', error);
  }
};

// 显示离线登录被阻止的提示
export const showOfflineLoginBlocked = () => {
  console.log('离线登录被阻止：从未登录过');
  // 这里可以显示一个UI提示，告诉用户需要先在线登录一次
};

// 检查用户对生产线的权限
export const checkLinePermission = async (userId, lineId) => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (netInfo.isConnected) {
      // 在线状态：从服务器检查
      
      // 1. 检查是否是生产线所有者
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('production_lines')
        .select('id')
        .eq('id', lineId)
        .eq('owner_id', userId)
        .eq('is_active', true);

      if (!ownerError && ownerCheck && ownerCheck.length > 0) {
        return {
          hasPermission: true,
          role: '金主'
        };
      }

      // 2. 检查是否是生产线成员
      const { data: memberCheck, error: memberError } = await supabase
        .from('production_line_members')
        .select('role')
        .eq('line_id', lineId)
        .eq('user_id', userId);

      if (!memberError && memberCheck && memberCheck.length > 0) {
        return {
          hasPermission: true,
          role: memberCheck[0].role
        };
      }

      // 无权限
      return {
        hasPermission: false,
        role: null
      };
    } else {
      // 离线状态：从缓存检查
      const allLines = await getOfflineData('production_lines', []);
      const line = allLines.find(l => l.id === lineId);
      
      if (line) {
        return {
          hasPermission: true,
          role: line.memberRole || 'owner'
        };
      }
      
      return {
        hasPermission: false,
        role: null
      };
    }
  } catch (error) {
    console.error('检查权限失败:', error);
    return {
      hasPermission: false,
      role: null
    };
  }
};

// 更新生产线名称
export const updateProductionLineName = async (lineId, newName) => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      // 离线状态：添加到待处理操作
      return await addPendingAction('UPDATE_PRODUCTION_LINE', {
        lineId,
        data: { name: newName }
      });
    }
    
    // 在线状态：直接更新
    const { error } = await supabase
      .from('production_lines')
      .update({ name: newName })
      .eq('id', lineId);
    
    if (error) {
      console.error('更新生产线名称失败:', error);
      return {
        success: false,
        message: '更新生产线名称失败'
      };
    }
    
    return {
      success: true,
      message: '生产线名称更新成功'
    };
  } catch (error) {
    console.error('更新生产线名称失败:', error);
    return {
      success: false,
      message: '更新生产线名称失败'
    };
  }
};

// 修改密码
export const changePassword = async (currentPassword, newPassword) => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      // 离线状态：修改密码需要在线
      console.log('离线状态，无法修改密码');
      return {
        success: false,
        message: '修改密码需要网络连接'
      };
    }
    
    // 获取当前用户信息
    const session = await SecureStore.getItemAsync(SESSION_KEY);
    if (!session) {
      return {
        success: false,
        message: '用户未登录'
      };
    }
    
    const sessionData = JSON.parse(session);
    const userId = sessionData.userId;
    
    // 从服务器获取当前用户信息，验证当前密码
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('获取用户信息失败:', fetchError);
      return {
        success: false,
        message: '获取用户信息失败'
      };
    }
    
    // 验证当前密码
    if (user.password !== currentPassword) {
      return {
        success: false,
        message: '当前密码错误'
      };
    }
    
    // 更新密码
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('id', userId);
    
    if (updateError) {
      console.error('更新密码失败:', updateError);
      return {
        success: false,
        message: '更新密码失败'
      };
    }
    
    console.log('密码修改成功');
    return {
      success: true,
      message: '密码修改成功'
    };
  } catch (error) {
    console.error('修改密码失败:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

// 初始化网络状态监听
export const initNetworkListener = () => {
  try {
    NetInfo.addEventListener(state => {
      console.log('网络状态变化:', state.isConnected);
      
      if (state.isConnected) {
        console.log('网络已连接，开始同步数据');
        // 网络恢复时，同步待处理的操作
        syncPendingActions();
      }
    });
    console.log('网络状态监听器已初始化');
  } catch (error) {
    console.error('初始化网络状态监听失败:', error);
  }
};
