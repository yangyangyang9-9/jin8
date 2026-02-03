import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// 导入页面组件
import StatisticsScreen from '../screens/StatisticsScreen';
import ManagementScreen from '../screens/ManagementScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProductionLineDetailScreen from '../screens/ProductionLineDetailScreen';
import MemberManagementScreen from '../screens/MemberManagementScreen';
import ProductionRecordScreen from '../screens/ProductionRecordScreen';
import FinancialManagementScreen from '../screens/FinancialManagementScreen';
import RenewalScreen from '../screens/RenewalScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

// 创建导航器
const Tab = createBottomTabNavigator();
const ManagementStack = createStackNavigator();
const SettingsStack = createStackNavigator();

// 管理页面堆栈导航
function ManagementStackNavigator() {
  return (
    <ManagementStack.Navigator>
      <ManagementStack.Screen 
        name="ManagementHome" 
        component={ManagementScreen} 
        options={{ headerShown: false }}
      />
      <ManagementStack.Screen 
        name="ProductionLineDetail" 
        component={ProductionLineDetailScreen} 
        options={{ headerShown: false }}
      />
      <ManagementStack.Screen 
        name="MemberManagement" 
        component={MemberManagementScreen} 
        options={{ headerShown: false }}
      />
      <ManagementStack.Screen 
        name="ProductionRecord" 
        component={ProductionRecordScreen} 
        options={{ headerShown: false }}
      />
      <ManagementStack.Screen 
        name="FinancialManagement" 
        component={FinancialManagementScreen} 
        options={{ headerShown: false }}
      />
      <ManagementStack.Screen 
        name="Renewal" 
        component={RenewalScreen} 
        options={{ headerShown: false }}
      />
    </ManagementStack.Navigator>
  );
}

// 设置页面堆栈导航
function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen 
        name="SettingsHome" 
        component={SettingsScreen} 
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen 
        name="Renewal" 
        component={RenewalScreen} 
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen 
        name="ChangePassword" 
        component={ChangePasswordScreen} 
        options={{ headerShown: false }}
      />
    </SettingsStack.Navigator>
  );
}

// 底部标签导航
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Statistics') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Management') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#D4AF37',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ tabBarLabel: '统计' }} />
      <Tab.Screen name="Management" component={ManagementStackNavigator} options={{ tabBarLabel: '管理' }} />
      <Tab.Screen name="Settings" component={SettingsStackNavigator} options={{ tabBarLabel: '设置' }} />
    </Tab.Navigator>
  );
}

export default MainTabNavigator;
