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
}
