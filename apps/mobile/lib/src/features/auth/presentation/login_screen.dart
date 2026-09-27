import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import 'auth_page_layout.dart';
import '../state/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return AuthPageLayout(
      title: 'Worker sign in',
      caption:
          'Access your shift board, onboarding status, and caregiver settings.',
      children: [
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _password,
          obscureText: _obscure,
          decoration: InputDecoration(
            labelText: 'Password',
            suffixIcon: IconButton(
              onPressed: () => setState(() => _obscure = !_obscure),
              icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => context.go('/forgot-password'),
            child: const Text('Forgot password?'),
          ),
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: auth.isLoading ? null : _submit,
          child: auth.isLoading
              ? const CircularProgressIndicator()
              : const Text('Sign in'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.go('/register'),
          child: const Text('Create worker account'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(_email.text, _password.text);
      if (mounted && ref.read(authControllerProvider).hasValue) {
        context.go('/home');
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Unable to sign in.'),
          isError: true,
        );
      }
    }
  }
}
