import { ActivityIndicator, StyleSheet, View } from 'react-native';

const SplashScreen = () => {
  return (
    <View style={style.container}>
      <ActivityIndicator />
    </View>
  );
};

export { SplashScreen };

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
