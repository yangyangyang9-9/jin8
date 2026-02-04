import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { login } from '../services/authService';
import { CommonActions } from '@react-navigation/native';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(username, password);
      
      if (result.success) {
        // 登录成功，导航到主页面
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          })
        );
      } else {
        Alert.alert('登录失败', result.message);
      }
    } catch (error) {
      Alert.alert('错误', '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>生产线管理系统</Text>
        <Text style={styles.subtitle}>登录以访问系统</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>用户名</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="请输入用户名"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="请输入密码"
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.loginButtonText}>登录</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerLink}>
          <Text style={styles.registerText}>还没有账号？</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerButton}>立即注册</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // 更深的背景色
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 80,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#D4AF37', // 黄金色
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#D4AF37', // 黄金色
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2d2d2d', // 深色输入框
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
    color: '#ffffff',
  },
  loginButton: {
    backgroundColor: '#D4AF37', // 黄金色
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#D4AF37',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loginButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: '#cccccc',
  },
  registerButton: {
    color: '#D4AF37', // 黄金色
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

export default LoginScreen;
