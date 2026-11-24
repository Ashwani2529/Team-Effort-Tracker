import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended, { ignores: ['dist/**'], rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/set-state-in-effect': 'off', 'react-hooks/incompatible-library': 'off', 'react-hooks/refs': 'off' } });
