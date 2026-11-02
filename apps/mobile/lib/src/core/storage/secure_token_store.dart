import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStore {
  SecureTokenStore(this._storage);

  static const _accessTokenKey = 'medshift.accessToken';
  static const _refreshTokenKey = 'medshift.refreshToken';
  static const _trustedDeviceTokenKey = 'medshift.trustedDeviceToken';
  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<String?> readTrustedDeviceToken() =>
      _storage.read(key: _trustedDeviceTokenKey);

  Future<void> writeAccessToken(String token) {
    return _storage.write(key: _accessTokenKey, value: token);
  }

  Future<void> writeTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
  }

  Future<void> writeTrustedDeviceToken(String token) =>
      _storage.write(key: _trustedDeviceTokenKey, value: token);

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) {
  return SecureTokenStore(ref.watch(secureStorageProvider));
});
