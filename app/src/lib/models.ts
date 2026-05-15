export const MODELS = {
  flash: {
    id: "xiaomi/mimo-v2.5",
    label: "Flash",
    blurb: "Fast, cheap default.",
  },
  boost: {
    id: "anthropic/claude-sonnet-4.6",
    label: "Boost",
    blurb: "Higher-quality reasoning.",
  },
} as const;

export type ModelKey = keyof typeof MODELS;

export function resolveModel(key: ModelKey | undefined): string {
  if (key && MODELS[key]) return MODELS[key].id;
  return MODELS.flash.id;
}
