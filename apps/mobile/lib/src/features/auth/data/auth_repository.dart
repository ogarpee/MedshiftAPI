import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_store.dart';

class AuthRepository {
  AuthRepository(this._dio, this._tokenStore);

  final Dio _dio;
  final SecureTokenStore _tokenStore;

  Future<AuthLoginResult> login({
    required String email,
    required String password,
  }) async {
    try {
      final trustedDeviceToken = await _tokenStore.readTrustedDeviceToken();
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {
          'email': email.trim(),
          'password': password,
          'clientType': 'MOBILE',
          'trustedDeviceToken': ?trustedDeviceToken,
        },
      );
      final data = response.data ?? {};
      if (data['twoFactorRequired'] == true) {
        return AuthLoginResult(challenge: TwoFactorChallenge.fromJson(data));
      }
      final session = AuthSession.fromJson(data);
      await _tokenStore.writeTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      );
      return AuthLoginResult(session: session);
    } catch (error) {
      throw ApiException(apiErrorMessage(error, 'Unable to sign in.'));
    }
  }

  Future<AuthSession> verifyTwoFactor({
    required String challengeId,
    required String code,
    required bool trustDevice,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/2fa/challenge/verify',
        data: {
          'challengeId': challengeId,
          'code': code.trim(),
          'trustDevice': trustDevice,
        },
      );
      final data = response.data ?? {};
      final session = AuthSession.fromJson(data);
      await _tokenStore.writeTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      );
      final trustedToken = data['trustedDeviceToken']?.toString();
      if (trustedToken != null && trustedToken.isNotEmpty) {
        await _tokenStore.writeTrustedDeviceToken(trustedToken);
      }
      return session;
    } catch (error) {
      throw ApiException(
        apiErrorMessage(error, 'Security code could not be verified.'),
      );
    }
  }

  Future<void> resendTwoFactor(String challengeId) async {
    try {
      await _dio.post(
        '/auth/2fa/challenge/resend',
        data: {'challengeId': challengeId},
      );
    } catch (error) {
      throw ApiException(
        apiErrorMessage(error, 'Security code could not be resent.'),
      );
    }
  }

  Future<AuthUser?> me() async {
    final token = await _tokenStore.readAccessToken();
    if (token == null || token.isEmpty) {
      return null;
    }

    try {
      final response = await _dio.get<Map<String, dynamic>>('/auth/me');
      return AuthUser.fromJson(response.data ?? {});
    } catch (_) {
      await _tokenStore.clear();
      return null;
    }
  }

  Future<void> startRegistration(String email) async {
    await _dio.post(
      '/auth/register/start',
      data: {'email': email.trim(), 'role': roleToApi(UserRole.worker)},
    );
  }

  Future<String> verifyRegistrationOtp({
    required String email,
    required String otp,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/register/verify-otp',
      data: {'email': email.trim(), 'otp': otp.trim()},
    );
    return (response.data?['completionToken'] ?? '').toString();
  }

  Future<AuthSession> completeRegistration({
    required String email,
    required String password,
    required String completionToken,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/register/complete',
      data: {
        'email': email.trim(),
        'password': password,
        'registrationToken': completionToken,
        'role': roleToApi(UserRole.worker),
        'clientType': 'MOBILE',
      },
    );
    final session = AuthSession.fromJson(response.data ?? {});
    await _tokenStore.writeTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
    return session;
  }

  Future<void> requestPasswordReset(String email) async {
    await _dio.post('/auth/forgot-password', data: {'email': email.trim()});
  }

  Future<void> verifyPasswordResetOtp({
    required String email,
    required String otp,
  }) async {
    await _dio.post(
      '/auth/forgot-password/verify-otp',
      data: {'email': email.trim(), 'otp': otp.trim()},
    );
  }

  Future<void> resetPassword({
    required String email,
    required String otp,
    required String password,
  }) async {
    await _dio.post(
      '/auth/reset-password',
      data: {'email': email.trim(), 'otp': otp.trim(), 'password': password},
    );
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {
      // Local sign-out must still complete when the server session is already revoked.
    } finally {
      await _tokenStore.clear();
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(dioProvider),
    ref.watch(secureTokenStoreProvider),
  );
});

class AuthLoginResult {
  const AuthLoginResult({this.session, this.challenge});
  final AuthSession? session;
  final TwoFactorChallenge? challenge;
}
