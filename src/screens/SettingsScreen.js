import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logout, getCurrentUser } from '../services/authService';
import { CommonActions } from '@react-navigation/native';

const SettingsScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 获取当前用户信息
    const fetchUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // 导航到登录页面
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            );
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name || user.username || '未知用户'}</Text>
            <Text style={styles.userId}>ID: {user.id}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>账户管理</Text>
          {user && (
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="person" size={24} color="#D4AF37" />
              </View>
              <Text style={styles.settingText}>登录名</Text>
              <Text style={styles.settingValue}>{user.username || '未知'}</Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('Renewal')}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="card" size={24} color="#D4AF37" />
            </View>
            <Text style={styles.settingText}>续费管理</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="lock-closed" size={24} color="#D4AF37" />
            </View>
            <Text style={styles.settingText}>修改密码</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>关于</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="call" size={24} color="#D4AF37" />
            </View>
            <Text style={styles.settingText}>联系我们</Text>
            <TouchableOpacity 
              onPress={() => {
                Clipboard.setString('jiu11111xiao');
                Alert.alert('成功', '微信ID已复制到剪贴板');
              }}
            >
              <Text style={styles.contactInfo}>微信: jiu11111xiao</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.version}>版本 1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // 更深的背景色
  },
  header: {
    backgroundColor: '#D4AF37', // 黄金色
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  userId: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  settingsSection: {
    backgroundColor: '#2d2d2d', // 深色卡片
    marginBottom: 15,
    marginTop: 15,
    marginHorizontal: 10,
    borderRadius: 12,
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
    fontSize: 14,
    color: '#D4AF37', // 黄金色
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.2)', // 半透明金色背景
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  settingValue: {
    fontSize: 14,
    color: '#cccccc',
    marginRight: 10,
  },
  contactInfo: {
    fontSize: 14,
    color: '#cccccc',
    marginRight: 10,
  },
  logoutButton: {
    backgroundColor: '#2d2d2d', // 深色按钮
    marginHorizontal: 20,
    marginTop: 30,
    paddingVertical: 15,
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
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF5252',
  },
  version: {
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 20,
    fontSize: 14,
    color: '#cccccc',
  },
});

export default SettingsScreen;
