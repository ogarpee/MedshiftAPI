import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/features/home/presentation/home_shell.dart';
import 'package:medshift_mobile/src/core/models/medshift_models.dart';
import 'package:medshift_mobile/src/core/theme/app_theme.dart';
import 'package:medshift_mobile/src/features/shifts/presentation/shift_board_screen.dart';
import 'package:medshift_mobile/src/features/shifts/state/shift_board_controller.dart';
import 'package:medshift_mobile/src/features/settings/presentation/account_preferences_sections.dart';
import 'package:medshift_mobile/src/features/settings/presentation/settings_screen.dart';
import 'package:medshift_mobile/src/features/settings/data/account_settings_repository.dart';

void main() {
  testWidgets('home shell exposes caregiver bottom navigation', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: HomeShell(
            testScreens: [
              SizedBox(key: Key('home')),
              SizedBox(key: Key('shifts')),
              SizedBox(key: Key('schedule')),
              SizedBox(key: Key('earnings')),
              SizedBox(key: Key('profile')),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Home'), findsWidgets);
    expect(find.text('Shifts'), findsWidgets);
    expect(find.text('Schedule'), findsOneWidget);
    expect(find.text('Earnings'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
  });

  testWidgets('onboarding banner exposes incomplete worker action', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WorkerOnboardingBanner(
            onboarding: const OnboardingState(
              verificationStatus: OnboardingStatus.incomplete,
            ),
            onPressed: () {},
          ),
        ),
      ),
    );

    expect(find.text('Complete onboarding to unlock shifts'), findsOneWidget);
    expect(find.text('Continue onboarding'), findsOneWidget);
  });

  testWidgets('onboarding banner shows rejection reason and update action', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WorkerOnboardingBanner(
            onboarding: const OnboardingState(
              verificationStatus: OnboardingStatus.rejected,
              rejectedReason: 'Replace the expired licence.',
            ),
            onPressed: () {},
          ),
        ),
      ),
    );

    expect(find.text('Replace the expired licence.'), findsOneWidget);
    expect(find.text('Update onboarding'), findsOneWidget);
  });

  testWidgets('profile onboarding card exposes every status action', (
    tester,
  ) async {
    final cases = [
      (
        const OnboardingState(verificationStatus: OnboardingStatus.incomplete),
        'Continue onboarding',
      ),
      (
        const OnboardingState(
          verificationStatus: OnboardingStatus.rejected,
          rejectedReason: 'Replace the expired licence.',
        ),
        'Update onboarding',
      ),
      (
        const OnboardingState(
          verificationStatus: OnboardingStatus.pendingReview,
        ),
        'Review submitted information',
      ),
      (
        const OnboardingState(verificationStatus: OnboardingStatus.approved),
        'Review and edit onboarding',
      ),
    ];

    for (final item in cases) {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WorkerOnboardingProfileCard(
              onboarding: item.$1,
              onPressed: () => tapped = true,
            ),
          ),
        ),
      );
      expect(find.text(item.$2), findsOneWidget);
      await tester.tap(find.text(item.$2));
      expect(tapped, isTrue);
    }
  });

  test('profile tab suppresses the shared onboarding banner', () {
    expect(
      shouldShowWorkerOnboardingBanner(
        selectedIndex: 0,
        status: OnboardingStatus.incomplete,
      ),
      isTrue,
    );
    expect(
      shouldShowWorkerOnboardingBanner(
        selectedIndex: 4,
        status: OnboardingStatus.incomplete,
      ),
      isFalse,
    );
  });

  testWidgets('password security flow uses a validating bottom drawer', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () => showModalBottomSheet<Map<String, String>>(
                context: context,
                isScrollControlled: true,
                showDragHandle: true,
                builder: (_) => const SecurityCredentialsSheet(
                  title: 'Change password',
                  includeCode: false,
                  includeNewPassword: true,
                ),
              ),
              child: const Text('Open security'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open security'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('security-current-password')),
      'Current123!',
    );
    await tester.enterText(
      find.byKey(const ValueKey('security-new-password')),
      'NewPassword123!',
    );
    await tester.enterText(
      find.byKey(const ValueKey('security-confirm-password')),
      'Different123!',
    );
    await tester.tap(find.byKey(const ValueKey('security-sheet-continue')));
    await tester.pump();
    expect(find.text('Passwords do not match.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('two-factor verification drawer validates six digits', (
    tester,
  ) async {
    const setup = TwoFactorSetup(
      id: 'setup-1',
      method: TwoFactorMethod.email,
      maskedEmail: 'i***@example.com',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () => showModalBottomSheet<String>(
                context: context,
                isScrollControlled: true,
                showDragHandle: true,
                builder: (_) => const SecurityVerificationSheet(setup: setup),
              ),
              child: const Text('Verify setup'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Verify setup'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('security-setup-code')),
      '12345',
    );
    await tester.tap(find.byKey(const ValueKey('security-verify-setup')));
    await tester.pump();
    expect(find.text('Enter the complete six-digit code.'), findsOneWidget);
  });

  testWidgets('shift search and filter controls fit a narrow screen', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(
            body: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: ShiftFilterPanel(state: ShiftBoardState()),
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Filters'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
