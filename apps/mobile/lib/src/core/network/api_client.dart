import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/secure_token_store.dart';

class ApiException implements Exception {
  const ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final tokenStore = ref.watch(secureTokenStoreProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 12),
      headers: {'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStore.readAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final request = error.requestOptions;
        if (error.response?.statusCode == 401 && request.path != '/auth/refresh' && request.extra['sessionRetried'] != true) {
          final refreshToken = await tokenStore.readRefreshToken();
          if (refreshToken != null && refreshToken.isNotEmpty) {
            try {
              final refreshClient = Dio(BaseOptions(baseUrl: config.apiBaseUrl, headers: {'Accept': 'application/json'}));
              final refreshResponse = await refreshClient.post<Map<String, dynamic>>('/auth/refresh', data: {'refreshToken': refreshToken});
              final data = refreshResponse.data ?? const <String, dynamic>{};
              final accessToken = data['accessToken']?.toString() ?? '';
              final replacementRefreshToken = data['refreshToken']?.toString();
              if (accessToken.isNotEmpty) {
                await tokenStore.writeTokens(accessToken: accessToken, refreshToken: replacementRefreshToken);
                request.headers['Authorization'] = 'Bearer $accessToken';
                request.extra['sessionRetried'] = true;
                handler.resolve(await dio.fetch(request));
                return;
              }
            } catch (_) {
              await tokenStore.clear();
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});

String apiErrorMessage(Object error, String fallback) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      final message = data['message'];
      if (message is List) {
        return message.join('\n');
      }
      return message.toString();
    }
  }
  if (error is ApiException) {
    return error.message;
  }
  return fallback;
}
