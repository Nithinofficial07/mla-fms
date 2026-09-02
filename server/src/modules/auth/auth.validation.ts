import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(3),
  password: z.string().min(1),
});

export const forgotSchema = z.object({ email: z.string().email() });

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'At least 8 characters').regex(/\d/, 'Needs a digit').regex(/[a-zA-Z]/, 'Needs a letter'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/\d/).regex(/[a-zA-Z]/),
});
