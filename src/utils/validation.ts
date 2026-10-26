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

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, 'Suchbegriff darf nicht leer sein')
  .max(100, 'Suchbegriff darf maximal 100 Zeichen lang sein')
  .refine(
    (q) => !/[\x00-\x1f\x7f]/.test(q),
    'Suchbegriff enthält unzulässige Steuerzeichen',
  );

export const gpxFileSchema = z.object({
  name: z.string().min(1).max(255).endsWith('.gpx', 'Nur .gpx-Dateien sind erlaubt'),
  size: z.number().int().positive().max(10 * 1024 * 1024, 'Datei darf maximal 10 MB groß sein'),
});

export const coordinatesSchema = z.tuple([
  z.number().min(-90, 'Breitengrad muss zwischen -90 und 90 liegen').max(90, 'Breitengrad muss zwischen -90 und 90 liegen'),
  z.number().min(-180, 'Längengrad muss zwischen -180 und 180 liegen').max(180, 'Längengrad muss zwischen -180 und 180 liegen'),
]);

export const routeInputSchema = z.object({
  title: z.string().trim().min(1, 'Titel darf nicht leer sein').max(200, 'Titel darf maximal 200 Zeichen lang sein'),
  summary: z.string().trim().max(1000, 'Zusammenfassung darf maximal 1000 Zeichen lang sein').optional(),
  distanceKm: z.number().nonnegative('Distanz darf nicht negativ sein').max(1000, 'Distanz darf maximal 1000 km betragen'),
  elevationGainM: z.number().nonnegative('Höhenmeter dürfen nicht negativ sein').max(50000, 'Höhenmeter dürfen maximal 50.000 m betragen'),
});

export type StationReviewInput = z.infer<typeof stationReviewSchema>;
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;
export type GpxImportInput = z.infer<typeof gpxImportSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type GpxFileInput = z.infer<typeof gpxFileSchema>;
export type CoordinatesInput = z.infer<typeof coordinatesSchema>;
export type RouteInput = z.infer<typeof routeInputSchema>;
