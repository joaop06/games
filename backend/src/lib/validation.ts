import { z } from "zod";

/** Normalize raw input: remove all spaces, lowercase, keep only a-z and 0-9 */
export function normalizeUsernameRaw(value: string): string {
  return value.replace(/\s/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const usernameNormalized = z
  .string()
  .transform((s) => normalizeUsernameRaw(s))
  .pipe(z.string().min(2).max(32).regex(/^[a-z0-9]+$/, "Username must be lowercase letters and numbers only"));
const passwordTrimmed = z.string().trim().min(8).max(128);

export const registerSchema = z.object({
  username: usernameNormalized,
  password: passwordTrimmed,
});

export const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export const inviteFriendSchema = z
  .object({
    username: z
      .string()
      .optional()
      .transform((s) => {
        if (s == null || s.length === 0) return undefined;
        const n = normalizeUsernameRaw(s);
        return n.length > 0 ? n : undefined;
      }),
    userId: z.string().uuid().optional(),
  })
  .refine((data) => data.userId != null || (data.username != null && data.username.length > 0), {
    message: "Provide username or userId",
  })
  .refine(
    (data) => {
      if (data.username == null || data.username.length === 0) return true;
      return data.username.length >= 2 && data.username.length <= 32 && /^[a-z0-9]+$/.test(data.username);
    },
    { message: "Username must be 2–32 chars, lowercase letters and numbers only" }
  );

export const createTicTacToeMatchSchema = z.object({
  opponentUserId: z.string().uuid().optional(),
});

export const listMatchesQuerySchema = z.object({
  status: z.enum(["waiting", "in_progress", "finished", "abandoned"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const checkUsernameQuerySchema = z.object({
  username: z.string().transform((s) => normalizeUsernameRaw(s)),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type InviteFriendBody = z.infer<typeof inviteFriendSchema>;
export type CreateTicTacToeMatchBody = z.infer<typeof createTicTacToeMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type CheckUsernameQuery = z.infer<typeof checkUsernameQuerySchema>;
