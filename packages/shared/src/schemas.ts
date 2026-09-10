import { z } from "zod";

export const MIN_AMOUNT_SATS = 100;
export const MAX_AMOUNT_SATS = 1_000_000;

const optionalUrl = z
  .union([z.url(), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const createBountySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(5000),
  repoUrl: optionalUrl,
  amountSats: z.number().int().min(MIN_AMOUNT_SATS).max(MAX_AMOUNT_SATS),
  expiresInSeconds: z.number().int().min(600).max(7 * 86400).optional(),
});

export const createSubmissionSchema = z.object({
  workerName: z.string().trim().min(1).max(80),
  workUrl: z.url(),
  notes: z.string().trim().max(5000).default(""),
  payoutInvoice: z.string().trim().min(20),
});

export const decisionSchema = z.object({
  submissionId: z.string().min(1),
});

export type CreateBountyInput = z.infer<typeof createBountySchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
