import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medshift_mobile/src/features/home/presentation/home_shell.dart';

void main() {
  testWidgets('home shell exposes caregiver bottom navigation', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: HomeShell(
            testScreens: [
              SizedBox(key: Key('shifts')),
              SizedBox(key: Key('work')),
              SizedBox(key: Key('alerts')),
              SizedBox(key: Key('settings')),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Shifts'), findsWidgets);
    expect(find.text('My Work'), findsOneWidget);
    expect(find.text('Alerts'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
  });
}
