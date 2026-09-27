import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';

class NotificationRepository {
  NotificationRepository(this._dio);

  final Dio _dio;

  Future<List<NotificationSummary>> list() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {'limit': 50},
    );
    final items = response.data?['items'] is List
        ? response.data!['items'] as List
        : const [];
    return items
        .map(
          (json) => NotificationSummary.fromJson(
            Map<String, dynamic>.from(json as Map),
          ),
        )
        .toList();
  }

  Future<void> markRead(String id) => _dio.patch('/notifications/$id/read');

  Future<void> markAllRead() => _dio.patch('/notifications/read-all');
}

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepository(ref.watch(dioProvider));
});
