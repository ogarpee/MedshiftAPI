import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStore {
  SecureTokenStore(this._storage);

  static const _accessTokenKey = 'medshift.accessToken';
  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<void> writeAccessToken(String token) {
    return _storage.write(key: _accessTokenKey, value: token);
  }

  Future<void> clear() => _storage.delete(key: _accessTokenKey);
}

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) {
  return SecureTokenStore(ref.watch(secureStorageProvider));
});
