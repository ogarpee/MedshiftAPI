import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/core/models/medshift_models.dart';
import 'package:medshift_mobile/src/features/notifications/data/notification_repository.dart';
import 'package:medshift_mobile/src/features/shifts/data/shift_repository.dart';

void main() {
  test('shift repository sends search filter query parameters', () async {
    final adapter = CapturingAdapter(const []);
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))
      ..httpClientAdapter = adapter;

    await ShiftRepository(dio).openShifts(
      location: const GeoPoint(longitude: -114.07, latitude: 51.04),
      radiusKm: 25,
      filters: const ShiftSearchFilters(
        roleRequired: ClinicalRole.rn,
        facilityType: FacilityType.hospital,
        radiusKm: 40,
        maxShiftHours: 8,
        minHourlyRate: 45,
        sort: ShiftSearchSort.hourlyRate,
      ),
    );

    expect(adapter.lastOptions?.path, '/matching/open-shifts');
    expect(adapter.lastOptions?.queryParameters['longitude'], -114.07);
    expect(adapter.lastOptions?.queryParameters['latitude'], 51.04);
    expect(adapter.lastOptions?.queryParameters['radiusKm'], 40);
    expect(adapter.lastOptions?.queryParameters['roleRequired'], 'RN');
    expect(adapter.lastOptions?.queryParameters['facilityType'], 'HOSPITAL');
    expect(adapter.lastOptions?.queryParameters['maxShiftHours'], 8);
    expect(adapter.lastOptions?.queryParameters['minHourlyRate'], 45);
    expect(adapter.lastOptions?.queryParameters['sort'], 'HOURLY_RATE');
  });

  test('notification repository parses paged notification response', () async {
    final adapter = CapturingAdapter({
      'items': [
        {
          'id': 'notification-1',
          'title': 'Shift update',
          'body': 'A new shift matches your profile.',
          'createdAt': '2026-09-26T10:00:00.000Z',
          'readAt': null,
        },
      ],
      'unreadCount': 1,
    });
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))
      ..httpClientAdapter = adapter;

    final notifications = await NotificationRepository(dio).list();

    expect(adapter.lastOptions?.path, '/notifications');
    expect(adapter.lastOptions?.queryParameters['limit'], 50);
    expect(notifications, hasLength(1));
    expect(notifications.single.id, 'notification-1');
    expect(notifications.single.unread, isTrue);
  });
}

class CapturingAdapter implements HttpClientAdapter {
  CapturingAdapter(this.body);

  final Object body;
  RequestOptions? lastOptions;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastOptions = options;
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
