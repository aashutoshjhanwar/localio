import React, { useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import ImageView from 'react-native-image-viewing';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

export function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  if (!images?.length) {
    return (
      <View style={[styles.hero, styles.heroPh]}>
        <Text style={{ fontSize: 48 }}>📦</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={images}
        keyExtractor={(u, i) => `${i}-${u}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <TouchableWithoutFeedback onPress={() => setViewerOpen(true)}>
            <Image source={{ uri: item }} style={styles.hero} resizeMode="cover" />
          </TouchableWithoutFeedback>
        )}
      />
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
      {images.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
        </View>
      )}
      <ImageView
        images={images.map((uri) => ({ uri }))}
        imageIndex={index}
        visible={viewerOpen}
        onRequestClose={() => setViewerOpen(false)}
        onImageIndexChange={setIndex}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width, height: 280, backgroundColor: '#EEE' },
  heroPh: { justifyContent: 'center', alignItems: 'center' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  counter: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
