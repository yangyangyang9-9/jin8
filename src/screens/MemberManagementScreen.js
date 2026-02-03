import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';
import { getCurrentUser } from '../services/authService';

const MemberManagementScreen = ({ navigation, route }) => {
  const { lineId, lineName } = route.params;
  const [user, setUser] = useState(null);

  // 初始化成员数据为空数组
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取当前用户信息
    const fetchUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  // 获取生产线成员数据
  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('production_line_members')
        .select('*, users(name, email, username)')
        .eq('line_id', lineId);

      if (error) {
        console.error('获取成员失败:', error);
        Alert.alert('错误', '获取成员失败');
      } else {
        // 转换数据格式
        const formattedMembers = (data || []).map(member => ({
          id: member.id,
          name: member.users?.name || member.users?.username || '未知',
          email: member.users?.email || '未知',
          username: member.users?.username || '未知',
          role: member.role
        }));
        setMembers(formattedMembers);
      }
    } catch (error) {
      console.error('获取成员失败:', error);
      Alert.alert('错误', '获取成员失败');
    } finally {
      setLoading(false);
    }
  };

  // 监听生产线ID变化
  useEffect(() => {
    fetchMembers();
  }, [lineId]);

  // 检测网络状态，确保联网时获取最新数据
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // 联网时，从Supabase获取最新数据
        fetchMembers();
      }
    });

    return () => unsubscribe();
  }, []);

  // 实时订阅成员变化
  useEffect(() => {
    // 订阅成员表的变化
    const subscription = supabase
      .channel(`production_line_members:${lineId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'production_line_members',
        filter: `line_id=eq.${lineId}`
      }, (payload) => {
        // 成员数据变化时，重新获取最新数据
        fetchMembers();
      })
      .subscribe();

    // 清理订阅
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [lineId]);

  const [modalVisible, setModalVisible] = useState(false);
  const [newMember, setNewMember] = useState({
    username: '',
    role: '班长'
  });

  const handleAddMember = async () => {
    if (!user) {
      Alert.alert('提示', '请先登录');
      return;
    }

    if (!newMember.username) {
      Alert.alert('提示', '请输入用户名');
      return;
    }

    // 这里暂时跳过权限检查，因为角色现在是基于生产线的
    // 实际应用中，应该从production_line_members表中获取用户在当前生产线的角色
    // if (user.role !== '金主' && user.role !== '线长') {
    //   Alert.alert('提示', '您没有权限添加成员');
    //   return;
    // }

    try {
      // 通过用户名查找用户
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('username', newMember.username);

      if (userError) {
        console.error('查找用户失败:', userError);
        Alert.alert('错误', '查找用户失败');
        return;
      }

      if (!users || users.length === 0) {
        Alert.alert('提示', '用户不存在，请先注册');
        return;
      }

      const userId = users[0].id;

      // 检查用户是否已经是该生产线的成员
      const { data: existingMembers, error: checkError } = await supabase
        .from('production_line_members')
        .select('id')
        .eq('line_id', lineId)
        .eq('user_id', userId);

      if (checkError) {
        console.error('检查成员失败:', checkError);
        Alert.alert('错误', '检查成员失败');
        return;
      }

      if (existingMembers && existingMembers.length > 0) {
        Alert.alert('提示', '用户已经是该生产线的成员');
        return;
      }

      // 添加成员
      const { data, error } = await supabase
        .from('production_line_members')
        .insert({
          line_id: lineId,
          user_id: userId,
          role: newMember.role
        })
        .select('*, users(name, email, username)');

      if (error) {
        console.error('添加成员失败:', error);
        Alert.alert('错误', '添加成员失败');
        return;
      }

      // 更新本地状态
      const newMemberData = {
        id: data[0].id,
        name: data[0].users?.name || data[0].users?.username || newMember.username,
        email: data[0].users?.email || `${newMember.username}@example.com`,
        role: data[0].role
      };

      setMembers([...members, newMemberData]);
      setNewMember({ username: '', role: '班长' });
      setModalVisible(false);
      Alert.alert('成功', '成员添加成功');
    } catch (error) {
      console.error('添加成员失败:', error);
      Alert.alert('错误', '添加成员失败');
    }
  };

  const handleRemoveMember = (id) => {
    if (!user) {
      Alert.alert('提示', '请先登录');
      return;
    }

    // 这里暂时跳过权限检查，因为角色现在是基于生产线的
    // 实际应用中，应该从production_line_members表中获取用户在当前生产线的角色
    // if (user.role !== '金主' && user.role !== '线长') {
    //   Alert.alert('提示', '您没有权限移除成员');
    //   return;
    // }

    Alert.alert(
      '确认移除',
      '确定要移除这个成员吗？',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '移除',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('production_line_members')
                .delete()
                .eq('id', id);

              if (error) {
                console.error('移除成员失败:', error);
                Alert.alert('错误', '移除成员失败');
                return;
              }

              // 更新本地状态
              setMembers(members.filter(member => member.id !== id));
              Alert.alert('成功', '成员移除成功');
            } catch (error) {
              console.error('移除成员失败:', error);
              Alert.alert('错误', '移除成员失败');
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
        <Text style={styles.title}>成员管理</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.memberList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无成员</Text>
              <Text style={styles.emptySubtext}>点击右上角添加成员</Text>
            </View>
          ) : (
            members.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberUsername}>登录名: {member.username}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: member.role === '金主' ? '#D4AF37' : member.role === '线长' ? '#4CAF50' : '#2196F3' }]}>
                    <Text style={styles.roleText}>{member.role}</Text>
                  </View>
                </View>
                {member.role !== '金主' && (
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(member.id)}
                  >
                    <Ionicons name="trash" size={20} color="#FF5252" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 添加成员模态框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加成员</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入用户名"
              value={newMember.username}
              onChangeText={(text) => setNewMember({ ...newMember, username: text })}
              autoCapitalize="none"
            />
            <View style={styles.roleSelector}>
              <Text style={styles.roleLabel}>角色:</Text>
              <View style={styles.roleOptions}>
                <TouchableOpacity 
                  style={[styles.roleOption, newMember.role === '线长' && styles.selectedRoleOption]}
                  onPress={() => setNewMember({ ...newMember, role: '线长' })}
                >
                  <Text style={[styles.roleOptionText, newMember.role === '线长' && styles.selectedRoleOptionText]}>线长</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleOption, newMember.role === '班长' && styles.selectedRoleOption]}
                  onPress={() => setNewMember({ ...newMember, role: '班长' })}
                >
                  <Text style={[styles.roleOptionText, newMember.role === '班长' && styles.selectedRoleOptionText]}>班长</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddMember}
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
  addButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  memberList: {
    padding: 10,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    marginBottom: 10,
    padding: 15,
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
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  memberUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  removeButton: {
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
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
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  roleSelector: {
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  roleOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  roleOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  selectedRoleOption: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedRoleOptionText: {
    color: 'white',
    fontWeight: 'bold',
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
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#D4AF37', // 黄金色
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MemberManagementScreen;
