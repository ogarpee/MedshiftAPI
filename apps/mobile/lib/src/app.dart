import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/app_widgets.dart';

class MedShiftMobileApp extends ConsumerWidget {
  const MedShiftMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);

    if (!config.hasValidApiBaseUrl) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'MedShift',
        theme: AppTheme.light(),
        home: ApiConfigurationErrorScreen(
          message: config.apiConfigurationError!,
        ),
      );
    }

    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'MedShift',
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}

class ApiConfigurationErrorScreen extends StatelessWidget {
  const ApiConfigurationErrorScreen({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const MedShiftLogo(),
                  const SizedBox(height: 24),
                  Text(
                    'API configuration required',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Text(message),
                  const SizedBox(height: 12),
                  const Text(
                    'Build with --dart-define=MEDSHIFT_API_URL=https://your-api-origin.',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
