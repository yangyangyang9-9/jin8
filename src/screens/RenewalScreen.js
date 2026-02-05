import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Linking, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RenewalScreen = ({ navigation }) => {


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
        <View style={styles.section}>
          <Ionicons name="information-circle" size={64} color="#D4AF37" style={styles.icon} />
          <Text style={styles.sectionTitle}>续费说明</Text>
          <Text style={styles.description}>
            为了给您提供更好的服务，我们的续费流程已优化。
            请联系我们的管理人员进行续费操作。
          </Text>
          <Text style={styles.description}>
            工作人员会根据您的需求，为您提供最合适的续费方案。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系方式</Text>
          <View style={styles.contactInfo}>
            <TouchableOpacity 
              style={styles.contactItem}
              onPress={() => {
                Clipboard.setString('jiu11111xiao');
                Alert.alert('成功', '微信ID已复制到剪贴板');
              }}
            >
              <Ionicons name="logo-wechat" size={24} color="#07C160" />
              <Text style={styles.contactText}>微信: jiu11111xiao</Text>
            </TouchableOpacity>
          </View>
        </View>



        <View style={styles.note}>
          <Text style={styles.noteText}>温馨提示：</Text>
          <Text style={styles.noteText}>• 续费成功后，您的生产线将自动续期</Text>
          <Text style={styles.noteText}>• 如有任何问题，请随时联系我们</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    alignItems: 'center',
  },
  icon: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  contactInfo: {
    width: '100%',
    marginTop: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 10,
  },
  contactText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    fontWeight: '500',
  },
  contactButton: {
    backgroundColor: '#D4AF37', // 黄金色
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 10,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  note: {
    backgroundColor: '#FFF3CD',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  noteText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 5,
  },
});

export default RenewalScreen;
