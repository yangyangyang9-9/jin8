import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';
import { getCurrentUser, getProductionLineMembers } from '../services/authService';

const FinancialManagementScreen = ({ navigation, route }) => {
  const { lineId, lineName } = route.params;

  // 初始化数据为0
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // 销售收入模态框
  const [salesModalVisible, setSalesModalVisible] = useState(false);
  const [newSale, setNewSale] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    quantity: '',
    price: '',
    notes: ''
  });

  // 支出模态框
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: '工资支出',
    notes: ''
  });

  // 获取当前用户信息和角色
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);

        // 获取用户在当前生产线中的角色
        const members = await getProductionLineMembers(lineId);
        const member = members.find(m => m.user_id === user.id);
        setUserRole(member?.role || null);
      }
    };

    fetchCurrentUser();
  }, [lineId]);

  // 从数据库获取财务记录
  const fetchFinancialRecords = async () => {
    setLoading(true);
    try {
      // 获取收入记录
      const { data: salesData, error: salesError } = await supabase
        .from('financial_records')
        .select('*')
        .eq('line_id', lineId)
        .eq('type', '收入');

      if (!salesError && salesData) {
        setSales(salesData);
      }

      // 获取支出记录
      const { data: expensesData, error: expensesError } = await supabase
        .from('financial_records')
        .select('*')
        .eq('line_id', lineId)
        .eq('type', '支出');

      if (!expensesError && expensesData) {
        setExpenses(expensesData);
      }
    } catch (error) {
      console.error('获取财务记录失败:', error);
    } finally {
      setLoading(false);
      calculateFinancials();
    }
  };

  // 监听生产线ID变化
  useEffect(() => {
    fetchFinancialRecords();
  }, [lineId]);

  // 检测网络状态，确保联网时获取最新数据
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // 联网时，从Supabase获取最新数据
        fetchFinancialRecords();
      }
    });

    return () => unsubscribe();
  }, []);

  // 监听财务记录变化，实时更新财务概览
  useEffect(() => {
    calculateFinancials();
  }, [sales, expenses]);

  // 计算财务数据
  const calculateFinancials = () => {
    // 确保sales和expenses是数组
    const validSales = Array.isArray(sales) ? sales : [];
    const validExpenses = Array.isArray(expenses) ? expenses : [];

    // 计算总收入，确保金额是有效的数字
    const salesTotal = validSales.reduce((sum, sale) => {
      const amount = parseFloat(sale.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    // 计算总支出，确保金额是有效的数字
    const expensesTotal = validExpenses.reduce((sum, expense) => {
      const amount = parseFloat(expense.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    // 计算净利润
    const profit = salesTotal - expensesTotal;

    setTotalSales(salesTotal);
    setTotalExpenses(expensesTotal);
    setNetProfit(profit);
  };

  // 添加销售收入
  const handleAddSale = async () => {
    if (!newSale.date || !newSale.amount || !newSale.quantity || !newSale.price) {
      Alert.alert('提示', '请填写完整的销售信息');
      return;
    }

    try {
      // 保存到数据库
      const { data, error } = await supabase
        .from('financial_records')
        .insert({
          line_id: lineId,
          date: newSale.date,
          amount: parseFloat(newSale.amount),
          type: '收入',
          category: '黄金销售收入',
          description: newSale.notes || `销售 ${newSale.quantity} g，单价 ¥${newSale.price}`
        })
        .select();

      if (error) {
        console.error('添加销售收入失败:', error);
        Alert.alert('错误', '添加销售收入失败');
        return;
      }

      // 更新本地状态
      setSales([data[0], ...sales]);
      setNewSale({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        quantity: '',
        price: '',
        notes: ''
      });
      setSalesModalVisible(false);
      calculateFinancials();
      Alert.alert('成功', '销售收入记录添加成功');
    } catch (error) {
      console.error('添加销售收入失败:', error);
      Alert.alert('错误', '添加销售收入失败');
    }
  };

  // 添加支出
  const handleAddExpense = async () => {
    if (!newExpense.date || !newExpense.amount || !newExpense.type) {
      Alert.alert('提示', '请填写完整的支出信息');
      return;
    }

    try {
      // 保存到数据库
      const { data, error } = await supabase
        .from('financial_records')
        .insert({
          line_id: lineId,
          date: newExpense.date,
          amount: parseFloat(newExpense.amount),
          type: '支出',
          category: newExpense.type,
          description: newExpense.notes || newExpense.type
        })
        .select();

      if (error) {
        console.error('添加支出失败:', error);
        Alert.alert('错误', '添加支出失败');
        return;
      }

      // 更新本地状态
      setExpenses([data[0], ...expenses]);
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        type: '工资支出',
        notes: ''
      });
      setExpenseModalVisible(false);
      calculateFinancials();
      Alert.alert('成功', '支出记录添加成功');
    } catch (error) {
      console.error('添加支出失败:', error);
      Alert.alert('错误', '添加支出失败');
    }
  };

  // 删除财务记录（金主和线长可操作）
  const handleDeleteFinancialRecord = async (record, recordType) => {
    // 检查用户是否为金主或线长角色
    if (userRole !== '金主' && userRole !== '线长') {
      Alert.alert('提示', '只有金主和线长角色可以删除财务记录');
      return;
    }

    Alert.alert(
      '确认删除',
      '确定要删除这条财务记录吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 从Supabase中删除
              const { error } = await supabase
                .from('financial_records')
                .delete()
                .eq('id', record.id);

              if (error) {
                console.error('删除财务记录失败:', error);
                Alert.alert('错误', '删除财务记录失败');
                return;
              }

              // 更新本地状态
              if (recordType === 'sales') {
                setSales(prevSales => prevSales.filter(r => r.id !== record.id));
              } else if (recordType === 'expenses') {
                setExpenses(prevExpenses => prevExpenses.filter(r => r.id !== record.id));
              }

              // 重新计算财务数据
              calculateFinancials();
              Alert.alert('成功', '财务记录已删除');
            } catch (error) {
              console.error('删除财务记录失败:', error);
              Alert.alert('错误', '删除财务记录失败');
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
        <Text style={styles.title}>财务管理</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* 财务概览 */}
          <View style={styles.overviewCard}>
            <Text style={styles.cardTitle}>财务概览</Text>
            <View style={styles.overviewGrid}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>总收入</Text>
                <Text style={[styles.overviewValue, styles.positiveValue]}>¥{totalSales.toFixed(2)} 元</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>总支出</Text>
                <Text style={[styles.overviewValue, styles.negativeValue]}>¥{totalExpenses.toFixed(2)} 元</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>净利润</Text>
                <Text style={[styles.overviewValue, netProfit >= 0 ? styles.positiveValue : styles.negativeValue]}>¥{netProfit.toFixed(2)} 元</Text>
              </View>
            </View>
          </View>

          {/* 操作按钮 */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.saleButton]}
              onPress={() => setSalesModalVisible(true)}
            >
              <Ionicons name="cash" size={24} color="white" />
              <Text style={styles.actionButtonText}>添加销售收入</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.expenseButton]}
              onPress={() => setExpenseModalVisible(true)}
            >
              <Ionicons name="card" size={24} color="white" />
              <Text style={styles.actionButtonText}>添加支出</Text>
            </TouchableOpacity>
          </View>

          {/* 销售收入记录 */}
          <View style={styles.recordCard}>
            <Text style={styles.cardTitle}>销售收入记录</Text>
            {sales.length === 0 ? (
              <Text style={styles.emptyText}>暂无销售收入记录</Text>
            ) : (
              <View style={styles.recordList}>
                {sales.map((sale) => (
              <View key={sale.id} style={styles.recordItem}>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordDate} selectable>{sale.date}</Text>
                  <Text style={styles.recordNotes} selectable>{sale.description || '无备注'}</Text>
                </View>
                <View style={styles.recordAmountContainer}>
                  <Text style={styles.saleAmount} selectable>¥{sale.amount} 元</Text>
                  {/* 金主和线长角色显示删除按钮 */}
                  {(userRole === '金主' || userRole === '线长') && (
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteFinancialRecord(sale, 'sales')}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF5252" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
              </View>
            )}
          </View>

          {/* 支出记录 */}
          <View style={styles.recordCard}>
            <Text style={styles.cardTitle}>支出记录</Text>
            {expenses.length === 0 ? (
              <Text style={styles.emptyText}>暂无支出记录</Text>
            ) : (
              <View style={styles.recordList}>
                {expenses.map((expense) => (
              <View key={expense.id} style={styles.recordItem}>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordDate} selectable>{expense.date}</Text>
                  <Text style={styles.recordType} selectable>{expense.category}</Text>
                  <Text style={styles.recordNotes} selectable>{expense.description || '无备注'}</Text>
                </View>
                <View style={styles.recordAmountContainer}>
                  <Text style={styles.expenseAmount} selectable>-¥{expense.amount} 元</Text>
                  {/* 金主和线长角色显示删除按钮 */}
                  {(userRole === '金主' || userRole === '线长') && (
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteFinancialRecord(expense, 'expenses')}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF5252" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* 添加销售收入模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={salesModalVisible}
        onRequestClose={() => setSalesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加销售收入</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请选择日期"
              value={newSale.date}
              onChangeText={(text) => setNewSale({ ...newSale, date: text })}
            />
            <View style={styles.inputWithUnit}>
              <TextInput
                style={styles.modalInputWithUnit}
                placeholder="请输入数量"
                value={newSale.quantity}
                onChangeText={(text) => setNewSale({ ...newSale, quantity: text })}
                keyboardType="numeric"
              />
              <Text style={styles.unitText}>g</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入单价"
              value={newSale.price}
              onChangeText={(text) => {
                setNewSale({ ...newSale, price: text });
                // 自动计算金额
                if (newSale.quantity && text) {
                  const amount = parseFloat(newSale.quantity) * parseFloat(text);
                  setNewSale(prev => ({ ...prev, amount: amount.toFixed(2) }));
                }
              }}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="请输入金额"
              value={newSale.amount}
              onChangeText={(text) => setNewSale({ ...newSale, amount: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="请输入备注"
              value={newSale.notes}
              onChangeText={(text) => setNewSale({ ...newSale, notes: text })}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setSalesModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddSale}
              >
                <Text style={styles.confirmButtonText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 添加支出模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseModalVisible}
        onRequestClose={() => setExpenseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加支出</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请选择日期"
              value={newExpense.date}
              onChangeText={(text) => setNewExpense({ ...newExpense, date: text })}
            />
            <View style={styles.expenseTypeSelector}>
              <Text style={styles.typeLabel}>支出类型:</Text>
              <View style={styles.typeOptions}>
                {['工资支出', '购物支出', '维修支出', '其它'].map((type) => (
                  <TouchableOpacity 
                    key={type}
                    style={[styles.typeOption, newExpense.type === type && styles.selectedTypeOption]}
                    onPress={() => setNewExpense({ ...newExpense, type })}
                  >
                    <Text style={[styles.typeOptionText, newExpense.type === type && styles.selectedTypeOptionText]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入金额"
              value={newExpense.amount}
              onChangeText={(text) => setNewExpense({ ...newExpense, amount: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="请输入备注"
              value={newExpense.notes}
              onChangeText={(text) => setNewExpense({ ...newExpense, notes: text })}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setExpenseModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddExpense}
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
    backgroundColor: '#121212',
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
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  overviewCard: {
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
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#D4AF37',
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    marginHorizontal: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  overviewLabel: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 5,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  positiveValue: {
    color: '#4CAF50',
  },
  negativeValue: {
    color: '#FF5252',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  saleButton: {
    backgroundColor: '#4CAF50',
  },
  expenseButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  recordCard: {
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
  recordList: {
    marginTop: 10,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  recordInfo: {
    flex: 1,
  },
  recordDate: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  recordType: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 4,
  },
  recordNotes: {
    fontSize: 12,
    color: '#999999',
  },
  saleAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF5252',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
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
  expenseTypeSelector: {
    marginBottom: 15,
  },
  typeLabel: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 8,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#3a3a3a',
  },
  selectedTypeOption: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#ffffff',
  },
  selectedTypeOptionText: {
    color: '#1a1a1a',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  recordAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 10,
    padding: 5,
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalInputWithUnit: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#3a3a3a',
    color: '#ffffff',
  },
  unitText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default FinancialManagementScreen;
