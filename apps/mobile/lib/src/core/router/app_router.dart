import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/state/auth_controller.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/intro/presentation/intro_screen.dart';
import '../../features/onboarding/presentation/worker_onboarding_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const IntroScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const WorkerOnboardingScreen(),
      ),
      GoRoute(path: '/home', builder: (context, state) => const HomeShell()),
    ],
    redirect: (context, state) => authRedirect(
      isLoading: auth.isLoading,
      isSignedIn: auth.value?.isSignedIn ?? false,
      location: state.matchedLocation,
    ),
  );
});

String? authRedirect({
  required bool isLoading,
  required bool isSignedIn,
  required String location,
}) {
  if (isLoading) return null;
  final isPublicAuthRoute = {
    '/',
    '/login',
    '/register',
    '/forgot-password',
  }.contains(location);
  if (!isSignedIn && !isPublicAuthRoute) return '/login';
  if (isSignedIn && isPublicAuthRoute) return '/home';
  return null;
}
