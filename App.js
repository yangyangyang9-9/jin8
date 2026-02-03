import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppContainer from './src/navigation/RootNavigator';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <AppContainer />
    </>
  );
}

