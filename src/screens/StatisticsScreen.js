import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getCurrentUser } from '../services/authService';

const StatisticsScreen = () => {
  // 初始化统计数据为0
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [monthlyProduction, setMonthlyProduction] = useState(0);
  const [todayProduction, setTodayProduction] = useState(0);
  const [yearlyProduction, setYearlyProduction] = useState(0);
  const [activeLines, setActiveLines] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [yearlySales, setYearlySales] = useState(0);
  const [goldSales, setGoldSales] = useState(0);
  const [monthlyGoldSales, setMonthlyGoldSales] = useState(0);
  const [yearlyGoldSales, setYearlyGoldSales] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [sales, setSales] = useState([]);
  const [goldSalesRecords, setGoldSalesRecords] = useState([]);
  const [productionRecords, setProductionRecords] = useState([]);
  const [productionLines, setProductionLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);
  const [modalType, setModalType] = useState('');

  // 获取当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    };

    fetchCurrentUser();
  }, []);
  

  


  // 从数据库获取实际数据
  const fetchData = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // 获取用户的生产线
      const { data: lines, error: linesError } = await supabase
        .from('production_lines')
        .select('*')
        .eq('owner_id', currentUser.id)
        .eq('is_active', true);

      if (!linesError && lines) {
        setProductionLines(lines);
        
        // 计算活跃生产线数量
        const active = lines.filter(line => line.status === '启用').length;
        setActiveLines(active);

        // 获取所有生产线的ID
        const lineIds = lines.map(line => line.id);

        if (lineIds.length > 0) {
          // 获取产量记录
          const { data: production, error: productionError } = await supabase
            .from('production_records')
            .select('*')
            .in('line_id', lineIds);

          if (!productionError && production) {
            setProductionRecords(production);
            
            // 计算本月产量
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const monthlyProduction = production
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + (record.quantity || 0), 0);
            
            setMonthlyProduction(monthlyProduction);

            // 计算今日产量
            const today = new Date().toISOString().split('T')[0];
            const todayProduction = production
              .filter(record => record.date === today)
              .reduce((sum, record) => sum + (record.quantity || 0), 0);
            
            setTodayProduction(todayProduction);

            // 计算年产量
            const yearlyProduction = production
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + (record.quantity || 0), 0);
            
            setYearlyProduction(yearlyProduction);
          }

          // 获取财务记录（销售）
          const { data: financials, error: financialsError } = await supabase
            .from('financial_records')
            .select('*')
            .in('line_id', lineIds)
            .eq('type', '收入');

          if (!financialsError && financials) {
            setSales(financials);
            
            // 过滤出黄金销售记录
            const goldSalesRecords = financials.filter(record => 
              record.category && record.category.includes('黄金')
            );
            setGoldSalesRecords(goldSalesRecords);
            
            // 计算本月收益
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const monthlyProfit = financials
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + record.amount, 0);
            
            setMonthlyProfit(monthlyProfit);
            
            // 计算年销售额
            const yearlySales = financials
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + record.amount, 0);
            
            setYearlySales(yearlySales);
            
            // 计算总销售额
            const totalSales = financials
              .reduce((sum, record) => sum + record.amount, 0);
            
            setTotalSales(totalSales);
            
            // 计算黄金销售数据
            // 总黄金销售额
            const totalGoldSales = goldSalesRecords
              .reduce((sum, record) => sum + record.amount, 0);
            setGoldSales(totalGoldSales);
            
            // 本月黄金销售额
            const monthlyGoldSales = goldSalesRecords
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + record.amount, 0);
            setMonthlyGoldSales(monthlyGoldSales);
            
            // 今年黄金销售额
            const yearlyGoldSales = goldSalesRecords
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + record.amount, 0);
            setYearlyGoldSales(yearlyGoldSales);
          }
        }
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 同步数据函数
  const handleSyncData = async () => {
    if (syncing || !currentUser) return;
    
    try {
      setSyncing(true);
      
      // 重新获取所有数据
      await fetchData();
      
      // 显示同步成功提示
      setTimeout(() => {
        alert('数据同步成功');
      }, 500);
    } catch (error) {
      console.error('同步数据失败:', error);
      alert('同步数据失败，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  // 从数据库获取实际数据
  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // 处理统计卡片点击事件
  const handleStatCardPress = (type) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    switch (type) {
      case 'monthlyProfit':
        setModalTitle('本月收益明细（按生产线）');
        setModalType('profit_by_line');
        // 过滤出本月的销售记录
        const monthlySales = sales.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
        });
        // 按生产线分组
        const profitByLine = monthlySales.reduce((groups, sale) => {
          const lineId = sale.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(sale);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总收益
        const profitByLineArray = Object.entries(profitByLine).map(([lineId, sales]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalAmount,
            sales
          };
        });
        setModalData(profitByLineArray);
        break;
      case 'monthlyProduction':
        setModalTitle('本月产量明细（按生产线）');
        setModalType('production_by_line');
        // 过滤出本月的产量记录
        const monthlyRecords = productionRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
        });
        // 按生产线分组
        const productionByLine = monthlyRecords.reduce((groups, record) => {
          const lineId = record.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(record);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总产量
        const productionByLineArray = Object.entries(productionByLine).map(([lineId, records]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalQuantity = records.reduce((sum, record) => sum + (record.quantity || 0), 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalQuantity,
            records
          };
        });
        setModalData(productionByLineArray);
        break;
      case 'todayProduction':
        setModalTitle('今日产量明细（按生产线）');
        setModalType('production_by_line');
        // 过滤出今日的产量记录
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = productionRecords.filter(record => record.date === today);
        // 按生产线分组
        const todayByLine = todayRecords.reduce((groups, record) => {
          const lineId = record.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(record);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总产量
        const todayByLineArray = Object.entries(todayByLine).map(([lineId, records]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalQuantity = records.reduce((sum, record) => sum + (record.quantity || 0), 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalQuantity,
            records
          };
        });
        setModalData(todayByLineArray);
        break;
      case 'yearlyProduction':
        setModalTitle('今年产量明细（按生产线）');
        setModalType('production_by_line');
        // 过滤出今年的产量记录
        const yearlyRecords = productionRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getFullYear() === currentYear;
        });
        // 按生产线分组
        const yearlyByLine = yearlyRecords.reduce((groups, record) => {
          const lineId = record.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(record);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总产量
        const yearlyByLineArray = Object.entries(yearlyByLine).map(([lineId, records]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalQuantity = records.reduce((sum, record) => sum + (record.quantity || 0), 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalQuantity,
            records
          };
        });
        setModalData(yearlyByLineArray);
        break;
      case 'goldSales':
        setModalTitle('总黄金销售额明细（按生产线）');
        setModalType('profit_by_line');
        // 按生产线分组黄金销售记录
        const goldByLine = goldSalesRecords.reduce((groups, sale) => {
          const lineId = sale.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(sale);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总黄金销售额
        const goldByLineArray = Object.entries(goldByLine).map(([lineId, sales]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalAmount,
            sales
          };
        });
        setModalData(goldByLineArray);
        break;
      case 'monthlyGoldSales':
        setModalTitle('本月黄金销售额明细（按生产线）');
        setModalType('profit_by_line');
        // 过滤出本月的黄金销售记录
        const monthlyGoldSalesRecords = goldSalesRecords.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
        });
        // 按生产线分组
        const monthlyGoldByLine = monthlyGoldSalesRecords.reduce((groups, sale) => {
          const lineId = sale.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(sale);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总黄金销售额
        const monthlyGoldByLineArray = Object.entries(monthlyGoldByLine).map(([lineId, sales]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalAmount,
            sales
          };
        });
        setModalData(monthlyGoldByLineArray);
        break;
      case 'yearlyGoldSales':
        setModalTitle('今年黄金销售额明细（按生产线）');
        setModalType('profit_by_line');
        // 过滤出今年的黄金销售记录
        const yearlyGoldSalesRecords = goldSalesRecords.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate.getFullYear() === currentYear;
        });
        // 按生产线分组
        const yearlyGoldByLine = yearlyGoldSalesRecords.reduce((groups, sale) => {
          const lineId = sale.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(sale);
          return groups;
        }, {});
        // 转换为数组并计算每条生产线的总黄金销售额
        const yearlyGoldByLineArray = Object.entries(yearlyGoldByLine).map(([lineId, sales]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalAmount,
            sales
          };
        });
        setModalData(yearlyGoldByLineArray);
        break;
    }
    setModalVisible(true);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>统计概览</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('monthlyProfit')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{monthlyProfit.toFixed(2)}</Text>
              <Text style={styles.statLabel}>本月收益(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('monthlyProduction')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{monthlyProduction}</Text>
              <Text style={styles.statLabel}>本月产量(g)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('todayProduction')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{todayProduction}</Text>
              <Text style={styles.statLabel}>今日产量(g)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('yearlyProduction')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{yearlyProduction}</Text>
              <Text style={styles.statLabel}>今年产量(g)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
          </View>
          
          {/* 黄金销售额统计模块 */}
          <View style={styles.goldSalesSection}>
            <Text style={styles.sectionTitle}>黄金销售额统计</Text>
            <View style={styles.goldStatsContainer}>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => handleStatCardPress('goldSales')}
                activeOpacity={0.7}
              >
                <Text style={styles.statValue}>¥{goldSales.toFixed(2)}</Text>
                <Text style={styles.statLabel}>总黄金销售额(元)</Text>
                <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => handleStatCardPress('monthlyGoldSales')}
                activeOpacity={0.7}
              >
                <Text style={styles.statValue}>¥{monthlyGoldSales.toFixed(2)}</Text>
                <Text style={styles.statLabel}>本月黄金销售额(元)</Text>
                <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => handleStatCardPress('yearlyGoldSales')}
                activeOpacity={0.7}
              >
                <Text style={styles.statValue}>¥{yearlyGoldSales.toFixed(2)}</Text>
                <Text style={styles.statLabel}>今年黄金销售额(元)</Text>
                <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* 同步数据按钮 */}
          <TouchableOpacity 
            style={[styles.syncButton, syncing && styles.syncingButton]}
            onPress={handleSyncData}
            disabled={syncing || loading}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="sync" 
              size={24} 
              color="white" 
              style={syncing ? styles.syncingIcon : {}}
            />
            <Text style={styles.syncButtonText}>
              {syncing ? '同步中...' : '同步数据'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* 统计明细模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {modalData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无明细数据</Text>
              </View>
            ) : modalType === 'profit_by_line' ? (
              modalData.map((lineItem, lineIndex) => (
                <View key={lineIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{lineItem.lineName}</Text>
                    <Text style={styles.groupTotal}>总金额: ¥{lineItem.totalAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.groupContent}>
                    {lineItem.sales.map((sale, saleIndex) => (
                      <View key={sale.id || saleIndex} style={styles.subItem}>
                        <View style={styles.subItemLeft}>
                          <Text style={styles.subItemDate}>{sale.date}</Text>
                          <Text style={styles.subItemDescription}>{sale.description || '销售记录'}</Text>
                        </View>
                        <Text style={styles.subItemAmount}>¥{sale.amount}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : modalType === 'production_by_line' ? (
              modalData.map((lineItem, lineIndex) => (
                <View key={lineIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{lineItem.lineName}</Text>
                    <Text style={styles.groupTotal}>总产量: {lineItem.totalQuantity} g</Text>
                  </View>
                  <View style={styles.groupContent}>
                    {lineItem.records.map((record, recordIndex) => (
                      <View key={record.id || recordIndex} style={styles.subItem}>
                        <View style={styles.subItemLeft}>
                          <Text style={styles.subItemDate}>{record.date}</Text>
                          <Text style={styles.subItemOperator}>操作人: {record.operator || '未知'}</Text>
                        </View>
                        <Text style={styles.subItemQuantity}>{record.quantity} g</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : modalType === 'profit' ? (
              modalData.map((item, index) => (
                <View key={item.id || index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemDate}>{item.date}</Text>
                    <Text style={styles.modalItemDescription}>{item.description || '销售记录'}</Text>
                  </View>
                  <Text style={styles.modalItemAmount}>+¥{item.amount}</Text>
                </View>
              ))
            ) : modalType === 'production' ? (
              modalData.map((item, index) => (
                <View key={item.id || index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemDate}>{item.date}</Text>
                    <Text style={styles.modalItemOperator}>操作人: {item.operator || '未知'}</Text>
                  </View>
                  <Text style={styles.modalItemQuantity}>{item.quantity} g</Text>
                </View>
              ))
            ) : modalType === 'production_by_day' ? (
              modalData.map((dayItem, dayIndex) => (
                <View key={dayIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{dayItem.date}</Text>
                    <Text style={styles.groupTotal}>总产量: {dayItem.totalQuantity} g</Text>
                  </View>
                  <View style={styles.groupContent}>
                    {dayItem.records.map((record, recordIndex) => (
                      <View key={record.id || recordIndex} style={styles.subItem}>
                        <View style={styles.subItemLeft}>
                          <Text style={styles.subItemOperator}>操作人: {record.operator || '未知'}</Text>
                        </View>
                        <Text style={styles.subItemQuantity}>{record.quantity} g</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : modalType === 'production_by_month' ? (
              modalData.map((monthItem, monthIndex) => (
                <View key={monthIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{monthItem.monthName}</Text>
                    <Text style={styles.groupTotal}>总产量: {monthItem.totalQuantity} g</Text>
                  </View>
                  <View style={styles.groupContent}>
                    {monthItem.records.length > 5 ? (
                      <Text style={styles.moreRecords}>共 {monthItem.records.length} 条记录</Text>
                    ) : (
                      monthItem.records.map((record, recordIndex) => (
                        <View key={record.id || recordIndex} style={styles.subItem}>
                          <View style={styles.subItemLeft}>
                            <Text style={styles.subItemDate}>{record.date}</Text>
                            <Text style={styles.subItemOperator}>操作人: {record.operator || '未知'}</Text>
                          </View>
                          <Text style={styles.subItemQuantity}>{record.quantity} g</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              ))
            ) : modalType === 'lines' ? (
              modalData.map((item, index) => (
                <View key={item.id || index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemStatus}>状态: {item.status}</Text>
                    <Text style={styles.modalItemExpire}>到期时间: {item.expire_date ? new Date(item.expire_date).toLocaleDateString() : '未知'}</Text>
                  </View>
                </View>
              ))
            ) : null
            }
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#1a1a1a',
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
    color: '#D4AF37',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#1a1a1a',
    marginBottom: 15,
    borderRadius: 12,
    marginHorizontal: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#D4AF37',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  syncButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  syncingIcon: {
    animationName: 'spin',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  statCard: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    width: '48%',
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#cccccc',
  },
  statIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  modalItemLeft: {
    flex: 1,
  },
  modalItemDate: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  modalItemDescription: {
    fontSize: 14,
    color: '#ffffff',
  },
  modalItemOperator: {
    fontSize: 14,
    color: '#ffffff',
  },
  modalItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalItemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#D4AF37',
    marginBottom: 4,
  },
  modalItemStatus: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 2,
  },
  modalItemExpire: {
    fontSize: 14,
    color: '#cccccc',
  },
  groupedItem: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  groupDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D4AF37',
  },
  groupTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  groupContent: {
    padding: 15,
  },
  subItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  subItemLeft: {
    flex: 1,
  },
  subItemDate: {
    fontSize: 12,
    color: '#cccccc',
    marginBottom: 2,
  },
  subItemOperator: {
    fontSize: 12,
    color: '#ffffff',
  },
  subItemQuantity: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D4AF37',
  },
  subItemDescription: {
    fontSize: 12,
    color: '#ffffff',
  },
  subItemAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  moreRecords: {
    fontSize: 12,
    color: '#cccccc',
    textAlign: 'center',
    paddingVertical: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#cccccc',
    paddingVertical: 20,
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
  salesList: {
    marginTop: 10,
  },
  salesItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  salesInfo: {
    flex: 1,
  },
  salesDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  salesProduct: {
    fontSize: 16,
    color: '#333',
  },
  salesAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37', // 黄金色
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
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
  goldSalesSection: {
    backgroundColor: '#1a1a1a',
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#D4AF37',
  },
  goldStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

export default StatisticsScreen;
