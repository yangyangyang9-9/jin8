import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { getCurrentUser, getProductionLineMembers } from '../services/authService';

// Supabase URL
const supabaseUrl = 'https://yogdjoisougtrgsuonbq.supabase.co';

const ProductionRecordScreen = ({ navigation, route }) => {
  const { lineId, lineName } = route.params;

  // 状态变量
  const [productionRecords, setProductionRecords] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    operator: '', // 自动填充当前用户
    notes: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 存储键
  const OFFLINE_RECORDS_KEY = `offline_records_${lineId}`;

  // 获取当前用户信息和角色
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setNewRecord(prev => ({
          ...prev,
          operator: user.name || user.username || user.email?.split('@')[0] || '未知用户'
        }));

        // 获取用户在当前生产线中的角色
        const members = await getProductionLineMembers(lineId);
        const member = members.find(m => m.user_id === user.id);
        setUserRole(member?.role || null);
      }
    };

    fetchCurrentUser();
  }, [lineId]);

  // 检测网络状态
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = isConnected;
      setIsConnected(state.isConnected);

      // 从离线变为在线时，自动同步数据
      if (!wasConnected && state.isConnected) {
        // 先同步离线记录
        syncOfflineRecords();
        // 然后从Supabase获取最新数据，确保以服务器数据为主
        fetchProductionRecords();
      }
    });

    return () => unsubscribe();
  }, [isConnected]);

  // 获取产量记录
  const fetchProductionRecords = async () => {
    if (!isConnected) {
      // 离线状态，从本地存储获取
      await loadOfflineRecords();
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('production_records')
        .select('*')
        .eq('line_id', lineId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取产量记录失败:', error);
        // 如果在线获取失败，尝试从本地存储获取
        await loadOfflineRecords();
      } else {
        // 为每条记录生成图片URL
        const recordsWithImageUrl = await Promise.all(
          (data || []).map(async (record) => {
            if (record.photo_path) {
              const imageUrl = await getImageSignedUrl(record.photo_path);
              return {
                ...record,
                image_url: imageUrl
              };
            }
            return record;
          })
        );
        
        setProductionRecords(recordsWithImageUrl);
        // 保存到本地，用于离线访问
        await saveRecordsToLocal(recordsWithImageUrl);
      }
    } catch (error) {
      console.error('获取产量记录失败:', error);
      // 尝试从本地存储获取
      await loadOfflineRecords();
    } finally {
      setLoading(false);
    }
  };

  // 监听生产线ID和网络状态变化
  useEffect(() => {
    fetchProductionRecords();
  }, [lineId, isConnected]);

  // 从本地存储加载记录
  const loadOfflineRecords = async () => {
    try {
      // 加载已同步的记录
      const syncedRecordsJson = await AsyncStorage.getItem(`synced_records_${lineId}`);
      const syncedRecords = syncedRecordsJson ? JSON.parse(syncedRecordsJson) : [];

      // 加载离线记录
      const offlineRecordsJson = await AsyncStorage.getItem(OFFLINE_RECORDS_KEY);
      const offlineRecords = offlineRecordsJson ? JSON.parse(offlineRecordsJson) : [];

      // 为已同步的记录生成图片URL（如果有photo_path但没有image_url）
      const syncedRecordsWithImageUrl = await Promise.all(
        syncedRecords.map(async (record) => {
          if (record.photo_path) {
            try {
              const imageUrl = await getImageSignedUrl(record.photo_path);
              return {
                ...record,
                image_url: imageUrl
              };
            } catch (error) {
              console.error('生成图片URL失败:', error);
              return record;
            }
          }
          return record;
        })
      );

      // 合并记录，离线记录优先
      setProductionRecords([...offlineRecords, ...syncedRecordsWithImageUrl]);
    } catch (error) {
      console.error('加载离线记录失败:', error);
      setProductionRecords([]);
    }
  };

  // 保存记录到本地
  const saveRecordsToLocal = async (records) => {
    try {
      await AsyncStorage.setItem(`synced_records_${lineId}`, JSON.stringify(records));
    } catch (error) {
      console.error('保存记录到本地失败:', error);
    }
  };

  // 保存离线记录
  const saveOfflineRecord = async (record, imageUri = null) => {
    try {
      const offlineRecordsJson = await AsyncStorage.getItem(OFFLINE_RECORDS_KEY);
      const offlineRecords = offlineRecordsJson ? JSON.parse(offlineRecordsJson) : [];
      
      const newOfflineRecord = {
        ...record,
        image_uri: imageUri,
        id: `offline_${Date.now()}`,
        isOffline: true,
        createdAt: new Date().toISOString()
      };

      const updatedOfflineRecords = [newOfflineRecord, ...offlineRecords];
      await AsyncStorage.setItem(OFFLINE_RECORDS_KEY, JSON.stringify(updatedOfflineRecords));

      return newOfflineRecord;
    } catch (error) {
      console.error('保存离线记录失败:', error);
      return null;
    }
  };

  // 请求相机权限并选择图片
  const pickImage = async () => {
    try {
      // 请求相机权限
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('提示', '需要相机权限才能拍照');
        return;
      }

      // 打开相机，设置更低的质量来减少文件大小
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6, // 降低质量从0.8到0.6
        base64: false, // 禁用base64编码以节省内存
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '选择图片失败，请重试');
    }
  };

  // 上传图片到Edge Function
  const uploadImage = async (imageUri, recordId) => {
    try {
      setUploadingImage(true);
      
      // 检查网络连接
      if (!isConnected) {
        console.error('网络连接失败，无法上传图片');
        return {
          status: 'failed',
          error: '网络连接失败'
        };
      }
      
      // 生成唯一的文件名和路径
      const photoPath = `${lineId}/${recordId}.jpg`;
      
      // 从URI中提取二进制数据
      try {
        const response = await fetch(imageUri);
        if (!response.ok) {
          throw new Error(`获取图片数据失败: ${response.status}`);
        }
        const blob = await response.blob();
        
        // 检查文件大小，限制在5MB以内
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        if (blob.size > maxFileSize) {
          console.error('图片文件过大，最大允许5MB');
          return {
            status: 'failed',
            error: '图片文件过大，最大允许5MB'
          };
        }
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('image', blob, `production_${recordId}.jpg`);
        formData.append('path', photoPath);
        
        // 调用Edge Function
        const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/upload-photo`, {
          method: 'POST',
          body: formData
        });
        
        if (!edgeResponse.ok) {
          throw new Error(`Edge Function调用失败: ${edgeResponse.status}`);
        }
        
        const edgeResult = await edgeResponse.json();
        
        if (edgeResult.success) {
          // 上传成功，返回状态和路径
          return {
            status: 'success',
            remotePath: photoPath
          };
        } else {
          console.error('Edge Function上传失败:', edgeResult.error);
          return {
            status: 'failed',
            error: edgeResult.error || '上传失败'
          };
        }
      } catch (fileError) {
        console.error('处理图片失败:', fileError);
        return {
          status: 'failed',
          error: '处理图片失败'
        };
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      
      // 网络错误处理模板
      if (error instanceof TypeError) {
        console.warn('🌐 网络异常，已进入重试队列');
        
        // 这里可以添加标记图片为待处理和调度重试的逻辑
        // markPhotoAsPending(photoId);
        // scheduleRetry(photoId);
        
        return {
          status: 'pending',
          error: '网络异常，正在重试'
        };
      }
      
      return {
        status: 'failed',
        error: '上传图片失败'
      };
    } finally {
      setUploadingImage(false);
    }
  };

  // 同步离线记录
  const syncOfflineRecords = async () => {
    if (!isConnected || syncing) return;

    setSyncing(true);
    try {
      const offlineRecordsJson = await AsyncStorage.getItem(OFFLINE_RECORDS_KEY);
      const offlineRecords = offlineRecordsJson ? JSON.parse(offlineRecordsJson) : [];

      if (offlineRecords.length === 0) {
        setSyncing(false);
        return;
      }

      // 成功同步的记录ID
      const syncedRecordIds = [];

      // 逐个同步记录
      for (const record of offlineRecords) {
        try {
          const { data, error } = await supabase
            .from('production_records')
            .insert({
              line_id: lineId,
              date: record.date,
              quantity: parseInt(record.quantity),
              operator: record.operator,
              notes: record.notes
            })
            .select();

          if (!error && data && data[0]) {
            // 记录同步成功
            syncedRecordIds.push(record.id);
            
            // 如果有图片，上传图片
            if (record.image_uri) {
              const uploadResult = await uploadImage(record.image_uri, data[0].id);
              if (uploadResult && uploadResult.status === 'success' && uploadResult.remotePath) {
                // 更新记录的图片路径
                await supabase
                  .from('production_records')
                  .update({ photo_path: uploadResult.remotePath })
                  .eq('id', data[0].id);
              }
            }
          }
        } catch (error) {
          console.error('同步离线记录失败:', error);
          // 继续同步其他记录
        }
      }

      // 只保留未同步成功的记录
      const unsyncedRecords = offlineRecords.filter(record => !syncedRecordIds.includes(record.id));
      if (unsyncedRecords.length > 0) {
        // 保存未同步成功的记录
        await AsyncStorage.setItem(OFFLINE_RECORDS_KEY, JSON.stringify(unsyncedRecords));
      } else {
        // 同步完成后清空离线记录
        await AsyncStorage.removeItem(OFFLINE_RECORDS_KEY);
      }

      // 重新获取最新数据，确保以服务器数据为主
      const { data, error } = await supabase
        .from('production_records')
        .select('*')
        .eq('line_id', lineId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // 为每条记录生成图片URL
        const recordsWithImageUrl = await Promise.all(
          data.map(async (record) => {
            if (record.photo_path) {
              const imageUrl = await getImageSignedUrl(record.photo_path);
              return {
                ...record,
                image_url: imageUrl
              };
            }
            return record;
          })
        );
        
        setProductionRecords(recordsWithImageUrl);
        await saveRecordsToLocal(recordsWithImageUrl);
      }

      // 显示同步成功提示
      Alert.alert('成功', `已同步 ${syncedRecordIds.length} 条离线记录`);
    } catch (error) {
      console.error('同步离线记录失败:', error);
      Alert.alert('错误', '同步离线记录失败，请稍后再试');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddRecord = async () => {
    if (!newRecord.date || !newRecord.quantity || !newRecord.operator) {
      Alert.alert('提示', '请填写日期、产量和操作人');
      return;
    }

    if (!selectedImage) {
      Alert.alert('提示', '请拍照上传图片后才能确认');
      return;
    }

    const record = {
      date: newRecord.date,
      quantity: parseInt(newRecord.quantity),
      operator: newRecord.operator,
      notes: newRecord.notes
    };

    try {
      if (isConnected) {
        // 在线状态，直接上传到Supabase
        const { data, error } = await supabase
          .from('production_records')
          .insert({
            line_id: lineId,
            ...record
          })
          .select();

        if (error) {
          console.error('添加产量记录失败:', error);
          // 上传失败，保存为离线记录
          const offlineRecord = await saveOfflineRecord(record, selectedImage);
          if (offlineRecord) {
            setProductionRecords([offlineRecord, ...productionRecords]);
            Alert.alert('提示', '网络连接不稳定，记录已保存为离线记录，将在网络恢复时自动同步');
          } else {
            Alert.alert('错误', '添加产量记录失败');
            return;
          }
        } else {
          // 保存记录后，异步上传图片
          setTimeout(async () => {
            const uploadResult = await uploadImage(selectedImage, data[0].id);
            if (uploadResult && uploadResult.status === 'success' && uploadResult.remotePath) {
              // 更新记录的图片路径
              await supabase
                .from('production_records')
                .update({ photo_path: uploadResult.remotePath })
                .eq('id', data[0].id);
              
              // 重新获取最新数据，确保包含image_url
              fetchProductionRecords();
            } else if (uploadResult && uploadResult.status === 'pending') {
              // 网络异常，显示提示
              Alert.alert('提示', '图片已保存，将在网络恢复后自动上传');
            }
          }, 1000);
          
          // 添加到本地状态，同时包含图片信息
          const recordWithImage = {
            ...data[0],
            image_uri: selectedImage // 临时使用本地URI，后续会被服务器数据替换
          };
          setProductionRecords([recordWithImage, ...productionRecords]);
          
          Alert.alert('成功', '产量记录添加成功');
        }
      } else {
        // 离线状态，保存为离线记录
        const offlineRecord = await saveOfflineRecord(record, selectedImage);
        if (offlineRecord) {
          setProductionRecords([offlineRecord, ...productionRecords]);
          Alert.alert('成功', '产量记录已保存为离线记录，将在网络恢复时自动同步');
        } else {
          Alert.alert('错误', '添加产量记录失败');
          return;
        }
      }

      // 重置表单
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        quantity: '',
        operator: currentUser?.name || currentUser?.email.split('@')[0] || '',
        notes: ''
      });
      setSelectedImage(null);
      setModalVisible(false);
    } catch (error) {
      console.error('添加产量记录失败:', error);
      Alert.alert('错误', '添加产量记录失败');
    }
  };

  // 获取图片的URL
  const getImageSignedUrl = async (photoPath) => {
    if (!photoPath) return null;
    
    try {
      // 构建永久的公共URL，确保图片可以长期访问
      // 这里使用公共存储桶的永久访问URL
      return `${supabaseUrl}/storage/v1/object/public/production-photos/${encodeURIComponent(photoPath)}`;
    } catch (error) {
      console.error('获取图片URL失败:', error);
      return null;
    }
  };

  // 查看产量记录明细
  const handleViewRecordDetail = async (record) => {
    setSelectedRecord(record);
    
    // 如果已经有image_url，直接使用
    if (record.image_url) {
      setDetailModalVisible(true);
      return;
    }
    
    // 如果有在线图片路径，获取Signed URL
    if (record.photo_path) {
      try {
        const signedUrl = await getImageSignedUrl(record.photo_path);
        if (signedUrl) {
          setSelectedRecord(prev => ({ ...prev, image_url: signedUrl }));
        }
      } catch (error) {
        console.error('获取图片URL失败:', error);
      }
    } 
    // 如果有离线图片路径，直接使用本地URI
    else if (record.image_uri) {
      setSelectedRecord(prev => ({ ...prev, image_url: record.image_uri }));
    }
    
    setDetailModalVisible(true);
  };

  // 删除产量记录（仅金主可操作）
  const handleDeleteRecord = async (record) => {
    // 检查用户是否为金主角色
    if (userRole !== '金主') {
      Alert.alert('提示', '只有金主角色可以删除产量记录');
      return;
    }

    Alert.alert(
      '确认删除',
      '确定要删除这条产量记录吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (record.isOffline) {
                // 离线记录，从本地存储中删除
                const offlineRecordsJson = await AsyncStorage.getItem(OFFLINE_RECORDS_KEY);
                const offlineRecords = offlineRecordsJson ? JSON.parse(offlineRecordsJson) : [];
                const updatedOfflineRecords = offlineRecords.filter(r => r.id !== record.id);
                await AsyncStorage.setItem(OFFLINE_RECORDS_KEY, JSON.stringify(updatedOfflineRecords));
              } else {
                // 在线记录，从Supabase中删除
                const { error } = await supabase
                  .from('production_records')
                  .delete()
                  .eq('id', record.id);

                if (error) {
                  console.error('删除产量记录失败:', error);
                  Alert.alert('错误', '删除产量记录失败');
                  return;
                }
              }

              // 更新本地状态
              setProductionRecords(prevRecords => prevRecords.filter(r => r.id !== record.id));
              Alert.alert('成功', '产量记录已删除');
            } catch (error) {
              console.error('删除产量记录失败:', error);
              Alert.alert('错误', '删除产量记录失败');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>产量管理</Text>
        <View style={styles.headerRight}>
          {/* 网络状态指示器 */}
          <View style={[styles.networkIndicator, { backgroundColor: isConnected ? '#4CAF50' : '#FF5252' }]}>
            <Ionicons 
              name={isConnected ? "wifi" : "wifi-off"} 
              size={20} 
              color="white" 
            />
          </View>
          {/* 手动同步按钮 */}
          <TouchableOpacity 
            style={[styles.syncButton, syncing && styles.syncingButton]}
            onPress={syncOfflineRecords}
            disabled={syncing || !isConnected}
          >
            <Ionicons 
              name="sync" 
              size={24} 
              color="white" 
              style={syncing ? styles.syncingIcon : {}}
            />
          </TouchableOpacity>
          {/* 添加按钮 */}
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : productionRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无产量记录</Text>
            <Text style={styles.emptySubtext}>点击右上角添加记录</Text>
          </View>
        ) : (
          <View style={styles.recordList}>
            {productionRecords.map((record) => (
              <TouchableOpacity 
                key={record.id} 
                style={styles.recordItem}
                onPress={() => handleViewRecordDetail(record)}
              >
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>{record.date}</Text>
                  <View style={styles.recordHeaderRight}>
                    {record.isOffline && (
                      <View style={styles.offlineBadge}>
                        <Text style={styles.offlineText}>离线</Text>
                      </View>
                    )}
                    <Text style={styles.recordQuantity}>{record.quantity} g</Text>
                    {/* 只有金主角色显示删除按钮 */}
                    {userRole === '金主' && (
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => handleDeleteRecord(record)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF5252" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.recordDetails}>
                  <Text style={styles.recordOperator}>操作人: {record.operator}</Text>
                  <Text style={styles.recordNotes}>备注: {record.notes}</Text>
                  {record.image_url && (
                    <View style={styles.imageIndicator}>
                      <Ionicons name="image" size={16} color="#D4AF37" />
                      <Text style={styles.imageIndicatorText}>已上传图片</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 添加产量记录模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加产量记录</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请选择日期"
              value={newRecord.date}
              onChangeText={(text) => setNewRecord({ ...newRecord, date: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="请输入产量"
              value={newRecord.quantity}
              onChangeText={(text) => setNewRecord({ ...newRecord, quantity: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="请输入操作人"
              value={newRecord.operator}
              onChangeText={(text) => setNewRecord({ ...newRecord, operator: text })}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="请输入备注"
              value={newRecord.notes}
              onChangeText={(text) => setNewRecord({ ...newRecord, notes: text })}
              multiline
              numberOfLines={3}
            />
            
            {/* 图片上传区域 */}
            <View style={styles.imageUploadSection}>
              <Text style={styles.imageUploadLabel}>拍照上传</Text>
              <TouchableOpacity 
                style={styles.imagePickerButton}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                {selectedImage ? (
                  <Image 
                    source={{ uri: selectedImage }} 
                    style={styles.selectedImage} 
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={48} color="#999" />
                    <Text style={styles.imagePlaceholderText}>点击拍照</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.imageRequiredText}>* 必须拍照上传图片</Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedImage(null);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddRecord}
                disabled={uploadingImage}
              >
                <Text style={styles.confirmButtonText}>
                  {uploadingImage ? '上传中...' : '确认'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* 记录明细查看模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>产量记录明细</Text>
            {selectedRecord && (
              <View style={styles.detailContent}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>日期:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.date}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>产量:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.quantity} g</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>操作人:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.operator}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>备注:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.notes || '无'}</Text>
                </View>
                {selectedRecord.image_url && (
                  <View style={styles.detailImageSection}>
                    <Text style={styles.detailImageLabel}>上传的图片:</Text>
                    <Image 
                      source={{ uri: selectedRecord.image_url }} 
                      style={styles.detailImage} 
                      resizeMode="contain"
                    />
                  </View>
                )}
                {!selectedRecord.image_url && (
                  <View style={styles.detailImageSection}>
                    <Text style={styles.detailImageLabel}>上传的图片:</Text>
                    <Text style={styles.detailNoImage}>无图片</Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.confirmButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D4AF37', // 黄金色
    padding: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  syncButton: {
    padding: 5,
    marginRight: 10,
  },
  syncingButton: {
    opacity: 0.7,
  },
  syncingIcon: {
    animationName: 'spin',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#cccccc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#cccccc',
  },
  recordHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineBadge: {
    backgroundColor: '#FF5252',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 10,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  recordList: {
    padding: 10,
  },
  recordItem: {
    backgroundColor: '#2d2d2d',
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  recordQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37', // 黄金色
  },
  recordDetails: {
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 10,
  },
  recordOperator: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  recordNotes: {
    fontSize: 14,
    color: '#cccccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#D4AF37',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#3a3a3a',
    color: '#ffffff',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#D4AF37', // 黄金色
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    marginLeft: 10,
    padding: 5,
  },
  imageUploadSection: {
    marginBottom: 20,
  },
  imageUploadLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 10,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#D4AF37',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#3a3a3a',
  },
  imagePlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 10,
  },
  selectedImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  imageRequiredText: {
    fontSize: 12,
    color: '#FF5252',
    textAlign: 'center',
  },
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  imageIndicatorText: {
    fontSize: 12,
    color: '#D4AF37',
    marginLeft: 5,
  },
  detailContent: {
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#cccccc',
    flex: 1,
  },
  detailImageSection: {
    marginTop: 15,
  },
  detailImageLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 10,
  },
  detailImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  detailNoImage: {
    fontSize: 14,
    color: '#cccccc',
    padding: 20,
    textAlign: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
  },
});

export default ProductionRecordScreen;
