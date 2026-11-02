import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../data/auth_repository.dart';

class AuthState {
  const AuthState({this.session, this.user, this.twoFactorChallenge});

  final AuthSession? session;
  final AuthUser? user;
  final TwoFactorChallenge? twoFactorChallenge;

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
      final result = await ref
          .read(authRepositoryProvider)
          .login(email: email, password: password);
      return AuthState(
        session: result.session,
        user: result.session?.user,
        twoFactorChallenge: result.challenge,
      );
    });
  }

  Future<void> verifyTwoFactor(String code, {required bool trustDevice}) async {
    final challenge = state.value?.twoFactorChallenge;
    if (challenge == null) return;
    state = const AsyncLoading();
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .verifyTwoFactor(
            challengeId: challenge.id,
            code: code,
            trustDevice: trustDevice,
          );
      state = AsyncData(AuthState(session: session, user: session.user));
    } catch (_) {
      state = AsyncData(AuthState(twoFactorChallenge: challenge));
      rethrow;
    }
  }

  Future<void> resendTwoFactor() async {
    final challenge = state.value?.twoFactorChallenge;
    if (challenge != null) {
      await ref.read(authRepositoryProvider).resendTwoFactor(challenge.id);
    }
  }

  void cancelTwoFactor() {
    state = const AsyncData(AuthState());
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
