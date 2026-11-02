import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/core/models/medshift_models.dart';
import 'package:medshift_mobile/src/features/settings/data/account_settings_repository.dart';

void main() {
  test('notification preferences parse and update both channels', () async {
    final adapter = QueueAdapter([
      AdapterResponse(_preferences(), 200),
      AdapterResponse(_preferences(), 200),
    ]);
    final repository = AccountSettingsRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = adapter,
    );
    final preferences = await repository.notificationPreferences();
    expect(preferences['SHIFT_OPPORTUNITIES']!.email, isTrue);
    await repository.updateNotificationPreferences({
      ...preferences,
      'SHIFT_OPPORTUNITIES': const NotificationChannels(
        inApp: true,
        email: false,
      ),
    });
    expect(adapter.options.last.path, '/notification-preferences/me');
    expect(
      (adapter.options.last.data as Map)['shiftOpportunities']['email'],
      isFalse,
    );
  });

  test('two-factor setup and trusted devices use account endpoints', () async {
    final adapter = QueueAdapter([
      AdapterResponse({
        'setupId': 'setup-1',
        'method': 'TOTP',
        'otpauthUri': 'otpauth://totp/MedShift',
        'manualKey': 'ABC',
      }, 200),
      AdapterResponse({
        'recoveryCodes': ['AAAA-BBBB'],
      }, 200),
      AdapterResponse([
        {
          'id': 'device-1',
          'label': 'MedShift mobile app',
          'lastUsedAt': '2026-11-01T10:00:00.000Z',
        },
      ], 200),
    ]);
    final repository = AccountSettingsRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = adapter,
    );
    final setup = await repository.beginTwoFactorSetup(
      method: TwoFactorMethod.totp,
      currentPassword: 'password1',
    );
    expect(setup.otpauthUri, startsWith('otpauth://'));
    expect(await repository.verifyTwoFactorSetup(setup.id, '123456'), [
      'AAAA-BBBB',
    ]);
    expect(
      (await repository.trustedDevices()).single.label,
      'MedShift mobile app',
    );
    expect(adapter.options.map((item) => item.path), [
      '/auth/2fa/setup',
      '/auth/2fa/setup/verify',
      '/auth/trusted-devices',
    ]);
  });
}

Map<String, dynamic> _preferences() => {
  for (final category in notificationCategories)
    category: {'inApp': true, 'email': true},
};

class AdapterResponse {
  const AdapterResponse(this.body, this.status);
  final Object body;
  final int status;
}

class QueueAdapter implements HttpClientAdapter {
  QueueAdapter(this.responses);
  final List<AdapterResponse> responses;
  final List<RequestOptions> options = [];
  @override
  void close({bool force = false}) {}
  @override
  Future<ResponseBody> fetch(
    RequestOptions request,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    options.add(request);
    final response = responses.removeAt(0);
    return ResponseBody.fromString(
      jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
