import { z } from 'zod';

export const stationReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(500, 'Kommentar darf maximal 500 Zeichen lang sein')
    .optional()
    .or(z.literal('')),
  stationId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export const reportIssueSchema = z.object({
  stationId: z.string().min(1),
  issueType: z.enum(['broken_charger', 'out_of_order', 'payment_issue', 'other']),
  description: z
    .string()
    .trim()
    .min(3, 'Beschreibung muss mindestens 3 Zeichen lang sein')
    .max(1000, 'Beschreibung darf maximal 1000 Zeichen lang sein'),
  contactEmail: z
    .string()
    .trim()
    .email('Ungültige E-Mail-Adresse')
    .optional()
    .or(z.literal('')),
});

export const gpxImportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  content: z.string().min(1),
});

export type StationReviewInput = z.infer<typeof stationReviewSchema>;
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;
export type GpxImportInput = z.infer<typeof gpxImportSchema>;
