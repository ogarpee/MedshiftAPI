import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';

const notificationCategories = [
  'SHIFT_OPPORTUNITIES',
  'SHIFT_UPDATES',
  'SCHEDULE_AND_TIMESHEETS',
  'REVIEWS_AND_DISPUTES',
  'ACCOUNT_AND_SECURITY',
];

class AccountSettingsRepository {
  AccountSettingsRepository(this._dio);
  final Dio _dio;

  Future<Map<String, NotificationChannels>> notificationPreferences() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notification-preferences/me',
    );
    final data = response.data ?? {};
    return {
      for (final category in notificationCategories)
        category: NotificationChannels.fromJson(data[category] as Map?),
    };
  }

  Future<Map<String, NotificationChannels>> updateNotificationPreferences(
    Map<String, NotificationChannels> value,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/notification-preferences/me',
      data: {
        'shiftOpportunities': value['SHIFT_OPPORTUNITIES']!.toJson(),
        'shiftUpdates': value['SHIFT_UPDATES']!.toJson(),
        'scheduleAndTimesheets': value['SCHEDULE_AND_TIMESHEETS']!.toJson(),
        'reviewsAndDisputes': value['REVIEWS_AND_DISPUTES']!.toJson(),
      },
    );
    return {
      for (final category in notificationCategories)
        category: NotificationChannels.fromJson(
          response.data?[category] as Map?,
        ),
    };
  }

  Future<TwoFactorAccountStatus> twoFactorStatus() async =>
      TwoFactorAccountStatus.fromJson(
        (await _dio.get<Map<String, dynamic>>('/auth/2fa')).data ?? {},
      );
  Future<List<TrustedDevice>> trustedDevices() async =>
      ((await _dio.get<List<dynamic>>('/auth/trusted-devices')).data ?? [])
          .map(
            (item) =>
                TrustedDevice.fromJson(Map<String, dynamic>.from(item as Map)),
          )
          .toList();

  Future<TwoFactorSetup> beginTwoFactorSetup({
    required TwoFactorMethod method,
    required String currentPassword,
    String? currentCode,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/2fa/setup',
      data: {
        'method': method == TwoFactorMethod.email ? 'EMAIL' : 'TOTP',
        'currentPassword': currentPassword,
        if (currentCode?.isNotEmpty == true) 'currentCode': currentCode,
      },
    );
    return TwoFactorSetup.fromJson(response.data ?? {});
  }

  Future<List<String>> verifyTwoFactorSetup(String setupId, String code) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/2fa/setup/verify',
      data: {'setupId': setupId, 'code': code},
    );
    return (response.data?['recoveryCodes'] as List? ?? [])
        .map((item) => item.toString())
        .toList();
  }

  Future<List<String>> regenerateRecoveryCodes(
    String password,
    String code,
  ) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/2fa/recovery-codes',
      data: {'currentPassword': password, 'code': code},
    );
    return (response.data?['recoveryCodes'] as List? ?? [])
        .map((item) => item.toString())
        .toList();
  }

  Future<void> disableTwoFactor(String password, String code) => _dio.delete(
    '/auth/2fa',
    data: {'currentPassword': password, 'code': code},
  );
  Future<void> sendTwoFactorManagementCode() =>
      _dio.post('/auth/2fa/manage-code');
  Future<void> revokeTrustedDevice(String? id) => _dio.delete(
    id == null ? '/auth/trusted-devices' : '/auth/trusted-devices/$id',
  );
  Future<void> changePassword(String currentPassword, String newPassword) =>
      _dio.patch(
        '/auth/password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );
  Future<void> logoutAll() => _dio.post('/auth/logout-all');
}

class NotificationChannels {
  const NotificationChannels({this.inApp = true, this.email = true});
  final bool inApp;
  final bool email;
  factory NotificationChannels.fromJson(Map? json) => NotificationChannels(
    inApp: json?['inApp'] != false,
    email: json?['email'] != false,
  );
  Map<String, dynamic> toJson() => {'inApp': inApp, 'email': email};
  NotificationChannels copyWith({bool? inApp, bool? email}) =>
      NotificationChannels(
        inApp: inApp ?? this.inApp,
        email: email ?? this.email,
      );
}

class TwoFactorAccountStatus {
  const TwoFactorAccountStatus({
    required this.enabled,
    required this.recoveryCodesRemaining,
    this.method,
  });
  final bool enabled;
  final int recoveryCodesRemaining;
  final TwoFactorMethod? method;
  factory TwoFactorAccountStatus.fromJson(Map<String, dynamic> json) =>
      TwoFactorAccountStatus(
        enabled: json['enabled'] == true,
        recoveryCodesRemaining:
            (json['recoveryCodesRemaining'] as num?)?.toInt() ?? 0,
        method: json['method'] == null
            ? null
            : twoFactorMethodFromApi(json['method'].toString()),
      );
}

class TwoFactorSetup {
  const TwoFactorSetup({
    required this.id,
    required this.method,
    this.manualKey,
    this.otpauthUri,
    this.maskedEmail,
  });
  final String id;
  final TwoFactorMethod method;
  final String? manualKey;
  final String? otpauthUri;
  final String? maskedEmail;
  factory TwoFactorSetup.fromJson(Map<String, dynamic> json) => TwoFactorSetup(
    id: (json['setupId'] ?? '').toString(),
    method: twoFactorMethodFromApi(json['method']?.toString()),
    manualKey: json['manualKey']?.toString(),
    otpauthUri: json['otpauthUri']?.toString(),
    maskedEmail: json['maskedEmail']?.toString(),
  );
}

class TrustedDevice {
  const TrustedDevice({
    required this.id,
    required this.label,
    required this.lastUsedAt,
  });
  final String id;
  final String label;
  final DateTime lastUsedAt;
  factory TrustedDevice.fromJson(Map<String, dynamic> json) => TrustedDevice(
    id: (json['id'] ?? '').toString(),
    label: (json['label'] ?? 'Trusted device').toString(),
    lastUsedAt:
        DateTime.tryParse(json['lastUsedAt']?.toString() ?? '') ??
        DateTime.now(),
  );
}

final accountSettingsRepositoryProvider = Provider<AccountSettingsRepository>(
  (ref) => AccountSettingsRepository(ref.watch(dioProvider)),
);
