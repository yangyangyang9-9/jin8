import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const PENDING_RECORDS_KEY = 'pending_production_records';
const LOCAL_PHOTOS_DIR = `${FileSystem.documentDirectory}production-photos/`;

// 生成唯一ID
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 初始化本地目录
const initLocalDir = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_PHOTOS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('初始化本地目录失败:', error);
  }
};

// 拍照
export const takePhoto = async () => {
  try {
    // 请求相机权限
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return {
        success: false,
        message: '需要相机权限才能拍照'
      };
    }

    // 启动相机
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return {
        success: true,
        photo: result.assets[0]
      };
    }

    return {
      success: false,
      message: '拍照被取消'
    };
  } catch (error) {
    console.error('拍照失败:', error);
    return {
      success: false,
      message: '拍照失败，请重试'
    };
  }
};

// 创建生产记录（支持离线）
export const createProductionRecord = async (lineId, quantity) => {
  try {
    await initLocalDir();
    
    // 生成记录ID
    const recordId = generateId();
    
    // 拍照
    const photoResult = await takePhoto();
    if (!photoResult.success) {
      return photoResult;
    }

    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (netInfo.isConnected) {
      // 在线状态：直接上传
      return await uploadRecordOnline(lineId, recordId, quantity, photoResult.photo);
    } else {
      // 离线状态：本地保存
      return await saveRecordOffline(lineId, recordId, quantity, photoResult.photo);
    }
  } catch (error) {
    console.error('创建生产记录失败:', error);
    return {
      success: false,
      message: '创建记录失败，请重试'
    };
  }
};

// 在线上传记录
const uploadRecordOnline = async (lineId, recordId, quantity, photo) => {
  try {
    // 获取当前用户ID
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        message: '用户未登录'
      };
    }

    // 读取图片文件
    const fileInfo = await FileSystem.getInfoAsync(photo.uri);
    if (!fileInfo.exists) {
      return {
        success: false,
        message: '图片文件不存在'
      };
    }

    // 读取文件内容
    const fileUri = photo.uri;
    const fileBlob = await fetch(fileUri).then(r => r.blob());

    // 上传图片到 Supabase Storage
    const storagePath = `${lineId}/${recordId}.jpg`;
    const { error: storageError } = await supabase.storage
      .from('production-photos')
      .upload(storagePath, fileBlob, { upsert: true });

    if (storageError) {
      console.error('上传图片失败:', storageError);
      return {
        success: false,
        message: '上传图片失败'
      };
    }

    // 写入生产记录表
    const { error: dbError } = await supabase
      .from('production_records')
      .insert({
        id: recordId,
        line_id: lineId,
        user_id: userId,
        quantity,
        photo_path: storagePath
      });

    if (dbError) {
      console.error('写入记录失败:', dbError);
      return {
        success: false,
        message: '写入记录失败'
      };
    }

    return {
      success: true,
      recordId
    };
  } catch (error) {
    console.error('在线上传失败:', error);
    return {
      success: false,
      message: '上传失败，请重试'
    };
  }
};

// 离线保存记录
const saveRecordOffline = async (lineId, recordId, quantity, photo) => {
  try {
    await initLocalDir();
    
    // 获取当前用户ID
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        message: '用户未登录'
      };
    }

    // 复制图片到本地存储
    const localPhotoPath = `${LOCAL_PHOTOS_DIR}${recordId}.jpg`;
    await FileSystem.copyAsync({
      from: photo.uri,
      to: localPhotoPath
    });

    // 创建待上传记录
    const pendingRecord = {
      recordId,
      lineId,
      userId,
      quantity,
      photoLocalPath: localPhotoPath,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // 获取现有待上传记录
    const pendingRecordsJson = await SecureStore.getItemAsync(PENDING_RECORDS_KEY);
    const pendingRecords = pendingRecordsJson ? JSON.parse(pendingRecordsJson) : [];

    // 添加新记录
    pendingRecords.push(pendingRecord);

    // 保存回 SecureStore
    await SecureStore.setItemAsync(PENDING_RECORDS_KEY, JSON.stringify(pendingRecords));

    return {
      success: true,
      recordId,
      offline: true
    };
  } catch (error) {
    console.error('离线保存失败:', error);
    return {
      success: false,
      message: '保存失败，请重试'
    };
  }
};

// 上传待处理记录
export const uploadPendingRecords = async () => {
  try {
    // 获取待上传记录
    const pendingRecordsJson = await SecureStore.getItemAsync(PENDING_RECORDS_KEY);
    if (!pendingRecordsJson) {
      return { success: true, uploaded: 0 };
    }

    const pendingRecords = JSON.parse(pendingRecordsJson);
    const successfullyUploaded = [];

    // 逐个上传记录
    for (const record of pendingRecords) {
      if (record.status === 'pending') {
        try {
          // 检查图片文件是否存在
          const fileInfo = await FileSystem.getInfoAsync(record.photoLocalPath);
          if (!fileInfo.exists) {
            console.error('本地图片文件不存在:', record.photoLocalPath);
            continue;
          }

          // 读取文件内容
          const fileBlob = await fetch(record.photoLocalPath).then(r => r.blob());

          // 上传图片到 Supabase Storage
          const storagePath = `${record.lineId}/${record.recordId}.jpg`;
          const { error: storageError } = await supabase.storage
            .from('production-photos')
            .upload(storagePath, fileBlob, { upsert: true });

          if (storageError) {
            console.error('上传图片失败:', storageError);
            continue;
          }

          // 写入生产记录表
          const { error: dbError } = await supabase
            .from('production_records')
            .insert({
              id: record.recordId,
              line_id: record.lineId,
              user_id: record.userId,
              quantity: record.quantity,
              photo_path: storagePath
            });

          if (dbError) {
            console.error('写入记录失败:', dbError);
            continue;
          }

          // 标记为已上传
          record.status = 'synced';
          successfullyUploaded.push(record.recordId);

          // 删除本地图片文件
          await FileSystem.deleteAsync(record.photoLocalPath, { idempotent: true });
        } catch (uploadError) {
          console.error('上传记录失败:', uploadError);
          // 继续上传其他记录
        }
      }
    }

    // 更新待上传记录列表
    const updatedRecords = pendingRecords.filter(r => r.status !== 'synced');
    await SecureStore.setItemAsync(PENDING_RECORDS_KEY, JSON.stringify(updatedRecords));

    return {
      success: true,
      uploaded: successfullyUploaded.length
    };
  } catch (error) {
    console.error('上传待处理记录失败:', error);
    return {
      success: false,
      message: '上传失败'
    };
  }
};

// 获取生产记录
export const getProductionRecords = async (lineId) => {
  try {
    // 检查网络状态
    const netInfo = await NetInfo.fetch();
    
    if (netInfo.isConnected) {
      // 在线状态：从服务器获取
      const { data, error } = await supabase
        .from('production_records')
        .select('*')
        .eq('line_id', lineId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取记录失败:', error);
        return [];
      }

      return data;
    } else {
      // 离线状态：返回空数组（实际项目中可以返回本地缓存）
      return [];
    }
  } catch (error) {
    console.error('获取生产记录失败:', error);
    return [];
  }
};

// 获取图片 URL
export const getPhotoUrl = async (photoPath) => {
  try {
    // 生成带签名的 URL
    const { data, error } = await supabase.storage
      .from('production-photos')
      .createSignedUrl(photoPath, 60); // 60秒有效期

    if (error) {
      console.error('获取图片 URL 失败:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('获取图片 URL 失败:', error);
    return null;
  }
};

// 初始化网络状态监听
export const initProductionNetworkListener = () => {
  try {
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log('网络已连接，开始上传待处理记录');
        uploadPendingRecords();
      }
    });
  } catch (error) {
    console.error('初始化网络监听失败:', error);
  }
};

// 获取当前用户ID（从 SecureStore）
const getCurrentUserId = async () => {
  try {
    const session = await SecureStore.getItemAsync('session');
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

// 导出初始化函数
export const initProductionService = async () => {
  await initLocalDir();
  initProductionNetworkListener();
};