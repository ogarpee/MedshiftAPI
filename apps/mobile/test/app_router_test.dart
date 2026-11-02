import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/core/router/app_router.dart';

void main() {
  test('authentication restoration does not redirect while loading', () {
    expect(
      authRedirect(isLoading: true, isSignedIn: false, location: '/onboarding'),
      isNull,
    );
  });

  test('restored authenticated user keeps onboarding deep link', () {
    expect(
      authRedirect(isLoading: false, isSignedIn: true, location: '/onboarding'),
      isNull,
    );
  });

  test('signed-out protected route returns to login', () {
    expect(
      authRedirect(
        isLoading: false,
        isSignedIn: false,
        location: '/onboarding',
      ),
      '/login',
    );
  });

  test('signed-in public auth route opens the dashboard', () {
    expect(
      authRedirect(isLoading: false, isSignedIn: true, location: '/login'),
      '/home',
    );
  });
}
