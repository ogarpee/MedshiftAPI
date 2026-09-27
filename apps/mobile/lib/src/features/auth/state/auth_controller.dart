import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../data/auth_repository.dart';

class AuthState {
  const AuthState({this.session, this.user});

  final AuthSession? session;
  final AuthUser? user;

  bool get isSignedIn => session != null || user != null;
}

class AuthController extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final user = await ref.watch(authRepositoryProvider).me();
    return AuthState(user: user);
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final session = await ref
          .read(authRepositoryProvider)
          .login(email: email, password: password);
      return AuthState(session: session, user: session.user);
    });
  }

  Future<void> completeRegistration({
    required String email,
    required String password,
    required String completionToken,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final session = await ref
          .read(authRepositoryProvider)
          .completeRegistration(
            email: email,
            password: password,
            completionToken: completionToken,
          );
      return AuthState(session: session, user: session.user);
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthState());
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
