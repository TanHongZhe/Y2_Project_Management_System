export const MODELS = {
  flash: {
    id: "google/gemma-4-31b-it",
    label: "Flash",
    blurb: "Fast, cheap default.",
  },
  boost: {
    id: "openai/gpt-5.4-nano",
    label: "Boost",
    blurb: "Higher-quality reasoning.",
  },
} as const;

export type ModelKey = keyof typeof MODELS;

export function resolveModel(key: ModelKey | undefined): string {
  if (key && MODELS[key]) return MODELS[key].id;
  return MODELS.flash.id;
}
