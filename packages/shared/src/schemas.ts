import { z } from "zod";

export const MIN_AMOUNT_SATS = 100;
export const MAX_AMOUNT_SATS = 1_000_000;

const optionalUrl = z
  .union([z.url(), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const REPO_FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const createBountySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(5000),
  repoUrl: optionalUrl,
  repoFullName: z.string().regex(REPO_FULL_NAME, "expected owner/name").optional().nullable(),
  amountSats: z.number().int().min(MIN_AMOUNT_SATS).max(MAX_AMOUNT_SATS),
  expiresInSeconds: z.number().int().min(600).max(7 * 86400).optional(),
});

// Signed-in workers pick a pull request (prNumber) on the bounty's repo or
// give a link. Guest mode (no GitHub configured) needs a name and a link.
export const createSubmissionSchema = z
  .object({
    workerName: z.string().trim().min(1).max(80).optional(),
    workUrl: z.url().optional(),
    prNumber: z.number().int().positive().optional(),
    notes: z.string().trim().max(5000).default(""),
    payoutInvoice: z.string().trim().min(20),
  })
  .refine((s) => s.workUrl || s.prNumber, { message: "a link to the work or a pull request is required", path: ["workUrl"] });

export const decisionSchema = z.object({
  submissionId: z.string().min(1),
});

export type CreateBountyInput = z.infer<typeof createBountySchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
