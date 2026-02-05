import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getCurrentUser, getCurrentUserId, checkLinePermission } from '../services/authService';

const StatisticsScreen = () => {
  // 初始化统计数据为0
  const [totalProfit, setTotalProfit] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [totalProduction, setTotalProduction] = useState(0);
  const [monthlyProduction, setMonthlyProduction] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [incomeRecords, setIncomeRecords] = useState([]);
  const [expenseRecords, setExpenseRecords] = useState([]);
  const [productionRecords, setProductionRecords] = useState([]);
  const [productionLines, setProductionLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [profitByMonth, setProfitByMonth] = useState([]);
  const [incomeByMonth, setIncomeByMonth] = useState([]);
  const [expenseByMonth, setExpenseByMonth] = useState([]);
  const [productionByMonth, setProductionByMonth] = useState([]);
  
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
      // 获取用户的所有生产线（包括拥有的和加入的）
      const { data: lines, error: linesError } = await supabase
        .from('production_lines')
        .select('*')
        .eq('is_active', true);

      if (!linesError && lines) {
        // 获取当前用户ID
        const userId = await getCurrentUserId();
        
        // 过滤出角色为金主和线长的生产线
        const filteredLines = [];
        
        for (const line of lines) {
          // 检查用户对该生产线的角色
          const permission = await checkLinePermission(userId, line.id);
          
          // 只统计角色为金主和线长的生产线
          if (permission.role === '金主' || permission.role === '线长') {
            filteredLines.push(line);
          }
        }
        
        setProductionLines(filteredLines);

        // 获取所有生产线的ID
        const lineIds = filteredLines.map(line => line.id);

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

            // 计算总产量
            const totalProduction = production
              .reduce((sum, record) => sum + (record.quantity || 0), 0);
            
            setTotalProduction(totalProduction);

            // 按月份计算产量
            const productionByMonth = {};
            production.forEach(record => {
              const recordDate = new Date(record.date);
              const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
              if (!productionByMonth[monthKey]) {
                productionByMonth[monthKey] = 0;
              }
              productionByMonth[monthKey] += (record.quantity || 0);
            });
            
            const productionByMonthArray = Object.entries(productionByMonth)
              .map(([month, quantity]) => ({
                month,
                quantity
              }))
              .sort((a, b) => a.month.localeCompare(b.month));
            
            setProductionByMonth(productionByMonthArray);
          }

          // 获取财务记录（收入）
          const { data: income, error: incomeError } = await supabase
            .from('financial_records')
            .select('*')
            .in('line_id', lineIds)
            .eq('type', '收入');

          if (!incomeError && income) {
            setIncomeRecords(income);
            
            // 计算本月收入
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const monthlyIncome = income
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + record.amount, 0);
            
            setMonthlyIncome(monthlyIncome);
            
            // 计算总收入
            const totalIncome = income
              .reduce((sum, record) => sum + record.amount, 0);
            
            setTotalIncome(totalIncome);

            // 按月份计算收入
            const incomeByMonth = {};
            income.forEach(record => {
              const recordDate = new Date(record.date);
              const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
              if (!incomeByMonth[monthKey]) {
                incomeByMonth[monthKey] = 0;
              }
              incomeByMonth[monthKey] += record.amount;
            });
            
            const incomeByMonthArray = Object.entries(incomeByMonth)
              .map(([month, amount]) => ({
                month,
                amount
              }))
              .sort((a, b) => a.month.localeCompare(b.month));
            
            setIncomeByMonth(incomeByMonthArray);
          }

          // 获取财务记录（支出）
          const { data: expense, error: expenseError } = await supabase
            .from('financial_records')
            .select('*')
            .in('line_id', lineIds)
            .eq('type', '支出');

          if (!expenseError && expense) {
            setExpenseRecords(expense);
            
            // 计算本月支出
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const monthlyExpense = expense
              .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
              })
              .reduce((sum, record) => sum + record.amount, 0);
            
            setMonthlyExpense(monthlyExpense);
            
            // 计算总支出
            const totalExpense = expense
              .reduce((sum, record) => sum + record.amount, 0);
            
            setTotalExpense(totalExpense);

            // 按月份计算支出
            const expenseByMonth = {};
            expense.forEach(record => {
              const recordDate = new Date(record.date);
              const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
              if (!expenseByMonth[monthKey]) {
                expenseByMonth[monthKey] = 0;
              }
              expenseByMonth[monthKey] += record.amount;
            });
            
            const expenseByMonthArray = Object.entries(expenseByMonth)
              .map(([month, amount]) => ({
                month,
                amount
              }))
              .sort((a, b) => a.month.localeCompare(b.month));
            
            setExpenseByMonth(expenseByMonthArray);
          }

          // 计算总净利和本月净利
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          
          // 计算本月净利
          const monthlyProfit = monthlyIncome - monthlyExpense;
          setMonthlyProfit(monthlyProfit);
          
          // 计算总净利
          const totalProfit = totalIncome - totalExpense;
          setTotalProfit(totalProfit);

          // 按月份计算净利
          const profitByMonth = {};
          
          // 合并收入和支出数据
          const allMonths = new Set([
            ...incomeByMonth.map(item => item.month),
            ...expenseByMonth.map(item => item.month)
          ]);
          
          allMonths.forEach(month => {
            const incomeAmount = incomeByMonth.find(item => item.month === month)?.amount || 0;
            const expenseAmount = expenseByMonth.find(item => item.month === month)?.amount || 0;
            profitByMonth[month] = incomeAmount - expenseAmount;
          });
          
          const profitByMonthArray = Object.entries(profitByMonth)
            .map(([month, amount]) => ({
              month,
              amount
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
          
          setProfitByMonth(profitByMonthArray);
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
      case 'totalProfit':
        setModalTitle('总净利明细（按月）');
        setModalType('profit_by_month');
        setModalData(profitByMonth);
        break;
      case 'monthlyProfit':
        setModalTitle('本月净利明细（按生产线）');
        setModalType('profit_by_line');
        // 过滤出本月的收入和支出记录
        const monthlyIncomeRecords = incomeRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
        });
        
        const monthlyExpenseRecords = expenseRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
        });
        
        // 按生产线分组计算净利
        const profitByLine = {};
        
        // 先处理收入
        monthlyIncomeRecords.forEach(record => {
          const lineId = record.line_id;
          if (!profitByLine[lineId]) {
            profitByLine[lineId] = {
              income: 0,
              expense: 0,
              incomeRecords: [],
              expenseRecords: []
            };
          }
          profitByLine[lineId].income += record.amount;
          profitByLine[lineId].incomeRecords.push(record);
        });
        
        // 再处理支出
        monthlyExpenseRecords.forEach(record => {
          const lineId = record.line_id;
          if (!profitByLine[lineId]) {
            profitByLine[lineId] = {
              income: 0,
              expense: 0,
              incomeRecords: [],
              expenseRecords: []
            };
          }
          profitByLine[lineId].expense += record.amount;
          profitByLine[lineId].expenseRecords.push(record);
        });
        
        // 转换为数组
        const profitByLineArray = Object.entries(profitByLine).map(([lineId, data]) => {
          const line = productionLines.find(l => l.id === lineId);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            income: data.income,
            expense: data.expense,
            profit: data.income - data.expense,
            incomeRecords: data.incomeRecords,
            expenseRecords: data.expenseRecords
          };
        });
        
        setModalData(profitByLineArray);
        break;
      case 'totalIncome':
        setModalTitle('总收入明细（按月）');
        setModalType('income_by_month');
        setModalData(incomeByMonth);
        break;
      case 'monthlyIncome':
        setModalTitle('本月收入明细（按生产线）');
        setModalType('income_by_line');
        // 过滤出本月的收入记录
        const monthlyIncomeByLine = incomeRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
        });
        
        // 按生产线分组
        const incomeByLine = monthlyIncomeByLine.reduce((groups, record) => {
          const lineId = record.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(record);
          return groups;
        }, {});
        
        // 转换为数组
        const incomeByLineArray = Object.entries(incomeByLine).map(([lineId, records]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalAmount,
            records
          };
        });
        
        setModalData(incomeByLineArray);
        break;
      case 'totalExpense':
        setModalTitle('总支出明细（按月）');
        setModalType('expense_by_month');
        setModalData(expenseByMonth);
        break;
      case 'monthlyExpense':
        setModalTitle('本月支出明细（按生产线）');
        setModalType('expense_by_line');
        // 过滤出本月的支出记录
        const monthlyExpenseByLine = expenseRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
        });
        
        // 按生产线分组
        const expenseByLine = monthlyExpenseByLine.reduce((groups, record) => {
          const lineId = record.line_id;
          if (!groups[lineId]) {
            groups[lineId] = [];
          }
          groups[lineId].push(record);
          return groups;
        }, {});
        
        // 转换为数组
        const expenseByLineArray = Object.entries(expenseByLine).map(([lineId, records]) => {
          const line = productionLines.find(l => l.id === lineId);
          const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
          return {
            lineId,
            lineName: line ? line.name : '未知生产线',
            totalAmount,
            records
          };
        });
        
        setModalData(expenseByLineArray);
        break;
      case 'totalProduction':
        setModalTitle('总产量明细（按月）');
        setModalType('production_by_month');
        setModalData(productionByMonth);
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
              onPress={() => handleStatCardPress('totalProfit')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{totalProfit.toFixed(2)}</Text>
              <Text style={styles.statLabel}>总净利(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('monthlyProfit')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{monthlyProfit.toFixed(2)}</Text>
              <Text style={styles.statLabel}>本月净利(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('totalIncome')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{totalIncome.toFixed(2)}</Text>
              <Text style={styles.statLabel}>总收入(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('monthlyIncome')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{monthlyIncome.toFixed(2)}</Text>
              <Text style={styles.statLabel}>本月收入(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('totalExpense')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{totalExpense.toFixed(2)}</Text>
              <Text style={styles.statLabel}>总支出(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('monthlyExpense')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>¥{monthlyExpense.toFixed(2)}</Text>
              <Text style={styles.statLabel}>本月支出(元)</Text>
              <Ionicons name="chevron-forward" size={16} color="#999" style={styles.statIcon} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => handleStatCardPress('totalProduction')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{totalProduction}</Text>
              <Text style={styles.statLabel}>总产量(g)</Text>
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
                <Ionicons name="close" size={24} color="red" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {modalData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无明细数据</Text>
              </View>
            ) : modalType === 'profit_by_month' ? (
              modalData.map((item, index) => (
                <View key={index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemDate}>{item.month}</Text>
                  </View>
                  <Text style={[styles.modalItemAmount, item.amount < 0 ? styles.negativeAmount : {}]}>
                    {item.amount >= 0 ? '+' : ''}¥{item.amount.toFixed(2)}
                  </Text>
                </View>
              ))
            ) : modalType === 'income_by_month' ? (
              modalData.map((item, index) => (
                <View key={index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemDate}>{item.month}</Text>
                  </View>
                  <Text style={styles.modalItemAmount}>¥{item.amount.toFixed(2)}</Text>
                </View>
              ))
            ) : modalType === 'expense_by_month' ? (
              modalData.map((item, index) => (
                <View key={index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemDate}>{item.month}</Text>
                  </View>
                  <Text style={styles.negativeAmount}>¥{item.amount.toFixed(2)}</Text>
                </View>
              ))
            ) : modalType === 'production_by_month' ? (
              modalData.map((item, index) => (
                <View key={index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemDate}>{item.month}</Text>
                  </View>
                  <Text style={styles.modalItemQuantity}>{item.quantity} g</Text>
                </View>
              ))
            ) : modalType === 'profit_by_line' ? (
              modalData.map((lineItem, lineIndex) => (
                <View key={lineIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{lineItem.lineName}</Text>
                    <Text style={[styles.groupTotal, lineItem.profit < 0 ? styles.negativeAmount : {}]}>
                      净利: {lineItem.profit >= 0 ? '+' : ''}¥{lineItem.profit.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.groupContent}>
                    <Text style={styles.subItemSectionTitle}>收入明细:</Text>
                    {lineItem.incomeRecords.length > 0 ? (
                      lineItem.incomeRecords.map((record, recordIndex) => (
                        <View key={record.id || recordIndex} style={styles.subItem}>
                          <View style={styles.subItemLeft}>
                            <Text style={styles.subItemDate}>{record.date}</Text>
                            <Text style={styles.subItemDescription}>{record.description || '收入记录'}</Text>
                          </View>
                          <Text style={styles.subItemAmount}>+¥{record.amount.toFixed(2)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>无收入记录</Text>
                    )}
                    
                    <Text style={[styles.subItemSectionTitle, { marginTop: 15 }]}>支出明细:</Text>
                    {lineItem.expenseRecords.length > 0 ? (
                      lineItem.expenseRecords.map((record, recordIndex) => (
                        <View key={record.id || recordIndex} style={styles.subItem}>
                          <View style={styles.subItemLeft}>
                            <Text style={styles.subItemDate}>{record.date}</Text>
                            <Text style={styles.subItemDescription}>{record.description || '支出记录'}</Text>
                          </View>
                          <Text style={styles.negativeAmount}>-¥{record.amount.toFixed(2)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>无支出记录</Text>
                    )}
                  </View>
                </View>
              ))
            ) : modalType === 'income_by_line' ? (
              modalData.map((lineItem, lineIndex) => (
                <View key={lineIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{lineItem.lineName}</Text>
                    <Text style={styles.groupTotal}>总收入: ¥{lineItem.totalAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.groupContent}>
                    {lineItem.records.map((record, recordIndex) => (
                      <View key={record.id || recordIndex} style={styles.subItem}>
                        <View style={styles.subItemLeft}>
                          <Text style={styles.subItemDate}>{record.date}</Text>
                          <Text style={styles.subItemDescription}>{record.description || '收入记录'}</Text>
                        </View>
                        <Text style={styles.subItemAmount}>¥{record.amount.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : modalType === 'expense_by_line' ? (
              modalData.map((lineItem, lineIndex) => (
                <View key={lineIndex} style={styles.groupedItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>{lineItem.lineName}</Text>
                    <Text style={styles.groupTotal}>总支出: ¥{lineItem.totalAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.groupContent}>
                    {lineItem.records.map((record, recordIndex) => (
                      <View key={record.id || recordIndex} style={styles.subItem}>
                        <View style={styles.subItemLeft}>
                          <Text style={styles.subItemDate}>{record.date}</Text>
                          <Text style={styles.subItemDescription}>{record.description || '支出记录'}</Text>
                        </View>
                        <Text style={styles.negativeAmount}>¥{record.amount.toFixed(2)}</Text>
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
  // 新增样式
  negativeAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f44336',
  },
  subItemSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 10,
    marginTop: 5,
  },
  noDataText: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
    paddingVertical: 5,
  },
});

export default StatisticsScreen;
