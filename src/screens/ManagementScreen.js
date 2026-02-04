import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getCurrentUserId, getUserProductionLines } from '../services/authService';

const ManagementScreen = ({ navigation }) => {
  // 初始化生产线数据为空数组
  const [productionLines, setProductionLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newLineName, setNewLineName] = useState('');

  // 获取生产线数据
  useEffect(() => {
    const fetchProductionLines = async () => {
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          // 使用getUserProductionLines函数获取用户拥有的和加入的所有生产线
          const allLines = await getUserProductionLines(userId);
          
          if (allLines && allLines.length > 0) {
            // 检查并更新到期的生产线状态
            const now = new Date();
            const updatedLines = [];
            
            for (const line of allLines) {
              const expireDate = new Date(line.expire_date);
              
              // 如果生产线已到期且状态为启用，则更新为停用
              if (now > expireDate && line.status === '启用') {
                const { error: updateError } = await supabase
                  .from('production_lines')
                  .update({ status: '停用' })
                  .eq('id', line.id);
                
                if (!updateError) {
                  // 更新本地数据
                  updatedLines.push({ ...line, status: '停用' });
                } else {
                  console.error('更新生产线状态失败:', updateError);
                  updatedLines.push(line);
                }
              } else {
                updatedLines.push(line);
              }
            }
            
            setProductionLines(updatedLines);
          }
        }
      } catch (error) {
        console.error('获取生产线失败:', error);
        Alert.alert('错误', '获取生产线失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProductionLines();
  }, []);

  const handleAddProductionLine = async () => {
    if (!newLineName) {
      Alert.alert('提示', '请输入生产线名称');
      return;
    }

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert('提示', '请先登录');
        return;
      }

      // 获取用户所有生产线
      const { data: existingLines, error: fetchError } = await supabase
        .from('production_lines')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_active', true);

      if (fetchError) {
        console.error('获取生产线失败:', fetchError);
        Alert.alert('错误', '获取生产线失败');
        return;
      }

      // 计算启用的生产线数量
      const enabledLinesCount = existingLines.filter(line => line.status === '启用').length;
      
      // 检查启用生产线数量限制
      if (enabledLinesCount >= 30) {
        Alert.alert('提示', '最多只能创建30条启用的生产线');
        return;
      }

      // 计算当前生产线总数
      const totalLinesCount = existingLines.length;
      
      // 计算到期时间（默认月付，30天后）
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 30);

      // 第二条及以后的生产线默认为停用状态
      const status = totalLinesCount === 0 ? '启用' : '停用';

      const { data, error } = await supabase
        .from('production_lines')
        .insert({
          name: newLineName,
          owner_id: userId,
          plan: '月付',
          price: 100.00,
          expire_date: expireDate,
          status: status,
          is_active: true
        })
        .select();

      if (error) {
        console.error('创建生产线失败:', error);
        Alert.alert('错误', '创建生产线失败');
        return;
      }

      // 更新本地状态
      setProductionLines([...productionLines, data[0]]);
      setNewLineName('');
      setModalVisible(false);
      Alert.alert('成功', `生产线创建成功，状态为${status}`);
    } catch (error) {
      console.error('创建生产线失败:', error);
      Alert.alert('错误', '创建生产线失败');
    }
  };

  const handleDeleteProductionLine = (id) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条生产线吗？',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = await getCurrentUserId();
              
              // 获取生产线详情
              const { data: lineData, error: fetchError } = await supabase
                .from('production_lines')
                .select('expire_date, status, owner_id')
                .eq('id', id)
                .single();

              if (fetchError) {
                console.error('获取生产线详情失败:', fetchError);
                Alert.alert('错误', '获取生产线详情失败');
                return;
              }

              // 检查是否是生产线的所有者
              if (lineData.owner_id !== userId) {
                Alert.alert('提示', '只有生产线的所有者才能删除生产线');
                return;
              }

              // 检查是否未到期且状态为启用
              const now = new Date();
              const expireDate = new Date(lineData.expire_date);
              
              if (now < expireDate && lineData.status === '启用') {
                Alert.alert('提示', '未到期的启用生产线不可删除');
                return;
              }

              const { error } = await supabase
                .from('production_lines')
                .update({ is_active: false })
                .eq('id', id);

              if (error) {
                console.error('删除生产线失败:', error);
                Alert.alert('错误', '删除生产线失败');
                return;
              }

              // 更新本地状态
              setProductionLines(productionLines.filter(line => line.id !== id));
              Alert.alert('成功', '生产线删除成功');
            } catch (error) {
              console.error('删除生产线失败:', error);
              Alert.alert('错误', '删除生产线失败');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>生产线管理</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : productionLines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无生产线</Text>
            <Text style={styles.emptySubtext}>点击右上角添加生产线</Text>
          </View>
        ) : (
          productionLines.map((line) => (
            <TouchableOpacity 
              key={line.id} 
              style={styles.lineCard}
              onPress={() => {
                if (line.status === '停用') {
                  navigation.navigate('Renewal');
                } else {
                  navigation.navigate('ProductionLineDetail', { lineId: line.id, lineName: line.name });
                }
              }}
            >
              <View style={styles.lineInfo}>
                <Text style={styles.lineName}>{line.name}</Text>
                <View style={styles.lineStatus}>
                  <View style={[styles.statusDot, { backgroundColor: line.status === '启用' ? '#4CAF50' : '#999' }]} />
                  <Text style={styles.statusText}>{line.status}</Text>
                </View>
                <Text style={styles.expireDate}>到期时间: {new Date(line.expire_date).toLocaleDateString()}</Text>
                <Text style={styles.planText}>计费方案: {line.plan}</Text>
                <Text style={styles.priceText}>价格: ¥{line.price.toFixed(2)}</Text>
                <Text style={styles.roleText}>角色: {line.memberRole || '未知'}</Text>
              </View>
              {line.memberRole === '金主' && (
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleDeleteProductionLine(line.id)}
                >
                  <Ionicons name="trash" size={20} color="#FF5252" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 添加生产线模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>创建生产线</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入生产线名称"
              value={newLineName}
              onChangeText={setNewLineName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddProductionLine}
              >
                <Text style={styles.confirmButtonText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // 更深的背景色
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
  planText: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '500',
  },
  roleText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '500',
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a', // 深灰色背景
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37', // 黄金色标题
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D4AF37', // 黄金色按钮
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flex: 1,
  },
  lineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d2d', // 深灰色卡片
    margin: 10,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37', // 黄金色左侧边框
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  lineInfo: {
    flex: 1,
  },
  lineName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  lineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#cccccc',
  },
  expireDate: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 14,
    color: '#cccccc',
  },
  deleteButton: {
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 25,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
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
    marginBottom: 20,
    color: '#ffffff',
    backgroundColor: '#3a3a3a',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelButton: {
    backgroundColor: '#444444',
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
});

export default ManagementScreen;
