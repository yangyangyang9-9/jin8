import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getCurrentUserId } from '../services/authService';

const RenewalScreen = ({ navigation }) => {
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [productionLines, setProductionLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);

  // 获取生产线数据
  useEffect(() => {
    const fetchProductionLines = async () => {
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          const { data, error } = await supabase
            .from('production_lines')
            .select('*')
            .eq('owner_id', userId)
            .eq('is_active', true);

          if (error) {
            console.error('获取生产线失败:', error);
            Alert.alert('错误', '获取生产线失败');
          } else {
            setProductionLines(data || []);
            // 默认选择第一条生产线
            if (data && data.length > 0) {
              setSelectedLine(data[0].id);
            }
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

  const handleRenewal = async () => {
    if (!selectedLine) {
      Alert.alert('提示', '请选择生产线');
      return;
    }

    setRenewing(true);
    try {
      // 获取当前生产线信息
      const { data: lines, error: lineError } = await supabase
        .from('production_lines')
        .select('*')
        .eq('id', selectedLine)
        .single();

      if (lineError) {
        console.error('获取生产线信息失败:', lineError);
        Alert.alert('错误', '获取生产线信息失败');
        return;
      }

      // 计算新的到期时间
      const currentExpireDate = new Date(lines.expire_date);
      const newExpireDate = new Date(currentExpireDate);
      
      if (selectedPlan === 'annual') {
        // 年付，增加365天
        newExpireDate.setDate(newExpireDate.getDate() + 365);
      } else {
        // 月付，增加30天
        newExpireDate.setDate(newExpireDate.getDate() + 30);
      }

      // 计算价格
      const price = selectedPlan === 'annual' ? 5999.00 : 599.00;

      // 更新生产线信息
      const { error: updateError } = await supabase
        .from('production_lines')
        .update({
          expire_date: newExpireDate,
          plan: selectedPlan === 'annual' ? '年付' : '月付',
          price: price,
          status: '启用',
          is_active: true
        })
        .eq('id', selectedLine);

      if (updateError) {
        console.error('续费失败:', updateError);
        Alert.alert('错误', '续费失败，请稍后重试');
        return;
      }

      Alert.alert('成功', '续费成功，生产线已更新');
      navigation.goBack();
    } catch (error) {
      console.error('续费失败:', error);
      Alert.alert('错误', '续费失败，请稍后重试');
    } finally {
      setRenewing(false);
    }
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
        <Text style={styles.title}>续费管理</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : productionLines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无生产线</Text>
            <Text style={styles.emptySubtext}>请先创建生产线</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>选择生产线</Text>
              <View style={styles.lineList}>
                {productionLines.map((line) => (
                  <TouchableOpacity 
                    key={line.id}
                    style={[styles.lineItem, selectedLine === line.id && styles.selectedLineItem]}
                    onPress={() => setSelectedLine(line.id)}
                  >
                    <Text style={[styles.lineName, selectedLine === line.id && styles.selectedLineName]}>{line.name}</Text>
                    <Text style={styles.lineExpireDate}>到期时间: {new Date(line.expire_date).toLocaleDateString()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>选择计费方案</Text>
              <View style={styles.planList}>
                <TouchableOpacity 
                  style={[styles.planItem, selectedPlan === 'monthly' && styles.selectedPlanItem]}
                  onPress={() => setSelectedPlan('monthly')}
                >
                  <Text style={[styles.planName, selectedPlan === 'monthly' && styles.selectedPlanText]}>月付</Text>
                  <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.selectedPlanText]}>¥599</Text>
                  <Text style={[styles.planPeriod, selectedPlan === 'monthly' && styles.selectedPlanText]}>30天</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.planItem, selectedPlan === 'annual' && styles.selectedPlanItem]}
                  onPress={() => setSelectedPlan('annual')}
                >
                  <Text style={[styles.planName, selectedPlan === 'annual' && styles.selectedPlanText]}>年付</Text>
                  <Text style={[styles.planPrice, selectedPlan === 'annual' && styles.selectedPlanText]}>¥5999</Text>
                  <Text style={[styles.planPeriod, selectedPlan === 'annual' && styles.selectedPlanText]}>365天</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.renewButton} 
              onPress={handleRenewal}
              disabled={renewing}
            >
              <Text style={styles.renewButtonText}>
                {renewing ? '续费中...' : '确认续费'}
              </Text>
            </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
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
  section: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  lineList: {
    marginTop: 10,
  },
  lineItem: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  selectedLineItem: {
    borderColor: '#D4AF37',
    backgroundColor: '#FFF3CD',
  },
  lineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  selectedLineName: {
    color: '#D4AF37',
  },
  lineExpireDate: {
    fontSize: 14,
    color: '#666',
  },
  planList: {
    marginTop: 10,
  },
  planItem: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedPlanItem: {
    borderColor: '#D4AF37',
    backgroundColor: '#D4AF37',
  },
  planName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 5,
  },
  planPeriod: {
    fontSize: 14,
    color: '#666',
  },
  selectedPlanText: {
    color: 'white',
  },
  renewButton: {
    backgroundColor: '#D4AF37', // 黄金色
    marginHorizontal: 20,
    marginTop: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  renewButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default RenewalScreen;
