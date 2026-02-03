import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>{lineName}</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D4AF37', // 黄金色
    padding: 20,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 10,
    padding: 20,
    borderRadius: 8,
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
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionsCard: {
    backgroundColor: 'white',
    margin: 10,
    padding: 20,
    borderRadius: 8,
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
    color: '#333',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3CD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  statsCard: {
    backgroundColor: 'white',
    margin: 10,
    padding: 20,
    borderRadius: 8,
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
    color: '#333',
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
    color: '#666',
  },
  disabledActions: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  disabledText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  renewButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  renewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProductionLineDetailScreen;
