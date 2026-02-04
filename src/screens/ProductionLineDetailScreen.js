import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { updateProductionLineName, checkLinePermission, getCurrentUserId } from '../services/authService';

const ProductionLineDetailScreen = ({ navigation, route }) => {
  const { lineId, lineName } = route.params;

  // 初始化产量统计数据为0
  const [todayProduction, setTodayProduction] = useState(0);
  const [monthProduction, setMonthProduction] = useState(0);
  const [yearProduction, setYearProduction] = useState(0);
  const [productionRecords, setProductionRecords] = useState([]);
  const [lineDetails, setLineDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [userRole, setUserRole] = useState(null);
  
  // 编辑生产线名称相关状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [newLineName, setNewLineName] = useState(lineName);

  // 实时订阅引用
  const subscriptionRef = useRef(null);

  // 获取生产线详情
  useEffect(() => {
    const fetchLineDetails = async () => {
      try {
        // 获取生产线信息
        const { data: lineData, error: lineError } = await supabase
          .from('production_lines')
          .select('*')
          .eq('id', lineId)
          .single();

        if (lineError) {
          console.error('获取生产线详情失败:', lineError);
          Alert.alert('错误', '获取生产线详情失败');
        } else {
          // 修改月付计费方案显示为599
          if (lineData.plan === '月付') {
            lineData.price = 599;
          }
          setLineDetails(lineData);
        }

        // 获取成员数量
        const { data: members, error: memberError } = await supabase
          .from('production_line_members')
          .select('id')
          .eq('line_id', lineId);

        if (memberError) {
          console.error('获取成员数量失败:', memberError);
        } else {
          setMemberCount(members ? members.length : 0);
        }

        // 获取产量记录
        const { data: records, error: recordError } = await supabase
          .from('production_records')
          .select('*')
          .eq('line_id', lineId)
          .order('created_at', { ascending: false });

        if (recordError) {
          console.error('获取产量记录失败:', recordError);
          // 如果表不存在，创建表
          if (recordError.code === '42P01') {
            await createProductionRecordsTable();
          }
        } else {
          setProductionRecords(records || []);
        }

        // 获取当前用户角色
        const userId = await getCurrentUserId();
        if (userId) {
          const permission = await checkLinePermission(userId, lineId);
          setUserRole(permission.role);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        Alert.alert('错误', '获取数据失败');
      } finally {
        setLoading(false);
      }
    };

    // 创建产量记录表（如果不存在）
    const createProductionRecordsTable = async () => {
      try {
        const { error } = await supabase.rpc('create_production_records_table');
        if (error) {
          console.error('创建产量记录表失败:', error);
        }
      } catch (error) {
        console.error('创建产量记录表失败:', error);
      }
    };

    fetchLineDetails();
  }, [lineId]);

  // 实时订阅产量记录变化
  useEffect(() => {
    // 订阅产量记录的变化
    subscriptionRef.current = supabase
      .channel(`production_records:${lineId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'production_records',
        filter: `line_id=eq.${lineId}`
      }, (payload) => {
        // 根据事件类型更新本地数据
        setProductionRecords(prevRecords => {
          if (payload.eventType === 'INSERT') {
            return [payload.new, ...prevRecords];
          } else if (payload.eventType === 'UPDATE') {
            return prevRecords.map(record => 
              record.id === payload.new.id ? payload.new : record
            );
          } else if (payload.eventType === 'DELETE') {
            return prevRecords.filter(record => record.id !== payload.old.id);
          }
          return prevRecords;
        });
      })
      .subscribe();

    // 清理订阅
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [lineId]);

  // 计算产量数据
  useEffect(() => {
    if (productionRecords.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // 计算今日产量
    const todayTotal = productionRecords
      .filter(record => {
        const recordDate = new Date(record.created_at || record.date);
        return recordDate.toISOString().split('T')[0] === today;
      })
      .reduce((sum, record) => sum + (record.quantity || 0), 0);

    // 计算本月产量
    const monthTotal = productionRecords
      .filter(record => {
        const recordDate = new Date(record.created_at || record.date);
        return recordDate.getMonth() + 1 === currentMonth && recordDate.getFullYear() === currentYear;
      })
      .reduce((sum, record) => sum + (record.quantity || 0), 0);

    // 计算全年产量
    const yearTotal = productionRecords
      .filter(record => {
        const recordDate = new Date(record.created_at || record.date);
        return recordDate.getFullYear() === currentYear;
      })
      .reduce((sum, record) => sum + (record.quantity || 0), 0);

    setTodayProduction(todayTotal);
    setMonthProduction(monthTotal);
    setYearProduction(yearTotal);
  }, [productionRecords]);

  // 处理保存生产线名称
  const handleSaveLineName = async () => {
    if (!newLineName.trim()) {
      Alert.alert('提示', '生产线名称不能为空');
      return;
    }

    if (newLineName === lineName) {
      setIsEditingName(false);
      return;
    }

    try {
      const result = await updateProductionLineName(lineId, newLineName);
      if (result.success) {
        Alert.alert('成功', '生产线名称更新成功');
        setIsEditingName(false);
        // 更新本地状态和路由参数
        navigation.setParams({ lineName: newLineName });
      } else {
        Alert.alert('错误', result.message || '更新失败');
      }
    } catch (error) {
      console.error('保存生产线名称失败:', error);
      Alert.alert('错误', '保存失败，请重试');
    }
  };

  // 处理取消编辑
  const handleCancelEdit = () => {
    setNewLineName(lineName);
    setIsEditingName(false);
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
        {isEditingName && userRole === '金主' ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={styles.nameInput}
              value={newLineName}
              onChangeText={setNewLineName}
              placeholder="请输入生产线名称"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              autoFocus
            />
            <TouchableOpacity onPress={handleSaveLineName}>
              <Ionicons name="checkmark" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{lineName}</Text>
            {userRole === '金主' && (
              <TouchableOpacity onPress={() => setIsEditingName(true)}>
                <Ionicons name="pencil" size={18} color="white" style={styles.editIcon} />
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>生产线信息</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>生产线ID:</Text>
                <Text style={styles.infoValue}>{lineId}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>状态:</Text>
                <Text style={[styles.infoValue, { color: lineDetails?.status === '启用' ? '#4CAF50' : '#999' }]}>{lineDetails?.status || '未知'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>到期时间:</Text>
                <Text style={styles.infoValue}>{lineDetails?.expire_date ? new Date(lineDetails.expire_date).toLocaleDateString() : '未知'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>计费方案:</Text>
                <Text style={styles.infoValue}>{lineDetails?.plan || '未知'} ¥{lineDetails?.price || 0}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>成员数量:</Text>
                <Text style={styles.infoValue}>{memberCount}人</Text>
              </View>
            </View>

            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>管理功能</Text>
              {lineDetails?.status === '启用' ? (
                <>
                  {/* 产量管理 - 所有角色都可以访问 */}
                  <TouchableOpacity 
                    style={styles.actionItem}
                    onPress={() => navigation.navigate('ProductionRecord', { lineId, lineName })}
                  >
                    <View style={styles.actionIcon}>
                      <Ionicons name="analytics" size={24} color="#D4AF37" />
                    </View>
                    <Text style={styles.actionText}>产量管理</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                  
                  {/* 成员管理 - 只有金主角色可以访问 */}
                  {userRole === '金主' && (
                    <TouchableOpacity 
                      style={styles.actionItem}
                      onPress={() => navigation.navigate('MemberManagement', { lineId, lineName })}
                    >
                      <View style={styles.actionIcon}>
                        <Ionicons name="people" size={24} color="#D4AF37" />
                      </View>
                      <Text style={styles.actionText}>成员管理</Text>
                      <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                  
                  {/* 财务管理 - 金主和线长角色可以访问 */}
                  {(userRole === '金主' || userRole === '线长') && (
                    <TouchableOpacity 
                      style={styles.actionItem}
                      onPress={() => navigation.navigate('FinancialManagement', { lineId, lineName })}
                    >
                      <View style={styles.actionIcon}>
                        <Ionicons name="cash" size={24} color="#D4AF37" />
                      </View>
                      <Text style={styles.actionText}>财务管理</Text>
                      <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.disabledActions}>
                  <Text style={styles.disabledText}>生产线已停用，无法访问管理功能</Text>
                  <TouchableOpacity 
                    style={styles.renewButton}
                    onPress={() => navigation.navigate('Renewal')}
                  >
                    <Text style={styles.renewButtonText}>立即续费</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>产量统计</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{todayProduction}</Text>
                  <Text style={styles.statLabel}>今日产量(g)</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{monthProduction}</Text>
                  <Text style={styles.statLabel}>本月产量(g)</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{yearProduction}</Text>
                  <Text style={styles.statLabel}>本年产量(g)</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D4AF37', // 黄金色
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
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  editIcon: {
    marginLeft: 8,
  },
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.7)',
  },
  cancelButton: {
    marginLeft: 10,
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#2d2d2d',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#D4AF37',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  infoLabel: {
    fontSize: 14,
    color: '#cccccc',
  },
  infoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  actionsCard: {
    backgroundColor: '#2d2d2d',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#D4AF37',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  statsCard: {
    backgroundColor: '#2d2d2d',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#D4AF37',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37', // 黄金色
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#cccccc',
  },
  disabledActions: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  disabledText: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 20,
    textAlign: 'center',
  },
  renewButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#D4AF37',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  renewButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProductionLineDetailScreen;
