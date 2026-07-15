import { StyleSheet, Text, View } from 'react-native';

type SimplePageProps = {
  title: string;
  description: string;
};

export function SimplePage({ title, description }: SimplePageProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f5f1',
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  text: {
    fontSize: 14,
    color: '#2a2d35',
    opacity: 0.8,
  },
});
