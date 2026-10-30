import { z } from "zod";
import {
  languageFields,
  type ContentKind,
  type Translatable,
} from "../src/lib/content-language";
import { bad } from "./validation";

export const translationsSchema = z
  .object({
    bn: z
      .record(
        z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*$/),
        z
          .object({ source: z.string().max(2000), text: z.string().max(2000) })
          .strict(),
      )
      .refine((v) => Object.keys(v).length <= 200, "Too many translated fields")
      .optional(),
  })
  .strict()
  .optional();

export function validateContentLanguages(
  kind: ContentKind,
  entity: Translatable & object,
) {
  const fields = languageFields(kind, entity);
  for (const [path, entry] of Object.entries(entity.translations?.bn || {})) {
    const field = fields.find((f) => f.path === path);
    if (!field || entry.text.length > field.max)
      throw bad(`Invalid translation: ${path}`);
  }
}
