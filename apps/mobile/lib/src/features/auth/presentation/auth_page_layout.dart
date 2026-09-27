import 'package:flutter/material.dart';

import '../../../core/widgets/app_widgets.dart';

class AuthPageLayout extends StatelessWidget {
  const AuthPageLayout({
    super.key,
    required this.title,
    required this.caption,
    required this.children,
  });

  final String title;
  final String caption;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 24),
            const MedShiftLogo(),
            const SizedBox(height: 32),
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(caption),
            const SizedBox(height: 24),
            ...children,
          ],
        ),
      ),
    );
  }
}
