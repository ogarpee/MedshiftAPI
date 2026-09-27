import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_store.dart';

class AuthRepository {
  AuthRepository(this._dio, this._tokenStore);

  final Dio _dio;
  final SecureTokenStore _tokenStore;

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email.trim(), 'password': password},
      );
      final session = AuthSession.fromJson(response.data ?? {});
      await _tokenStore.writeAccessToken(session.accessToken);
      return session;
    } catch (error) {
      throw ApiException(apiErrorMessage(error, 'Unable to sign in.'));
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
        'completionToken': completionToken,
      },
    );
    final session = AuthSession.fromJson(response.data ?? {});
    await _tokenStore.writeAccessToken(session.accessToken);
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

  Future<void> logout() => _tokenStore.clear();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(dioProvider),
    ref.watch(secureTokenStoreProvider),
  );
});
