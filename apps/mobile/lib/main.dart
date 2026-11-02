import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import 'src/app.dart';

void main() {
  const mapboxAccessToken = String.fromEnvironment('MAPBOX_ACCESS_TOKEN');
  if (mapboxAccessToken.isNotEmpty) {
    MapboxOptions.setAccessToken(mapboxAccessToken);
  }
  runApp(const ProviderScope(child: MedShiftMobileApp()));
}
