import type { CollectionVariant, Language } from "../types";

export interface CollectionVariantGroup {
  key: string;
  label: string;
  variants: CollectionVariant[];
}

function sequenceDescriptor(variant: CollectionVariant, language: Language) {
  const title = variant.title.trim();
  const chineseMatch = title.match(
    /第\s*0*(\d+)\s*(节课|节|课|讲|章|集)/i,
  );
  if (chineseMatch) {
    const number = String(Number(chineseMatch[1]));
    const unit = chineseMatch[2];
    return {
      key: `zh:${unit}:${number}`,
      label:
        language === "zh" ? `第 ${number} ${unit}` : `Section ${number}`,
    };
  }

  const englishMatch = title.match(
    /\b(part|lesson|chapter|episode|section|p)\s*[._-]?\s*0*(\d+)\b/i,
  );
  if (englishMatch) {
    const kind = englishMatch[1].toLowerCase();
    const number = String(Number(englishMatch[2]));
    return {
      key: `en:${kind}:${number}`,
      label:
        kind === "p"
          ? `P${number.padStart(2, "0")}`
          : `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${number}`,
    };
  }

  return {
    key: "other",
    label: language === "zh" ? "其他分P" : "Other parts",
  };
}

function shortParentheticalTag(title: string) {
  const matches = [...title.matchAll(/[（(]([^（）()]{1,4})[）)]/g)];
  return matches.at(-1)?.[1]?.trim() || "";
}

export function groupCollectionVariants(
  variants: CollectionVariant[],
  language: Language,
) {
  const groups = new Map<string, CollectionVariantGroup>();
  variants.forEach((variant) => {
    const descriptor = sequenceDescriptor(variant, language);
    const existing = groups.get(descriptor.key);
    if (existing) {
      existing.variants.push(variant);
      return;
    }
    groups.set(descriptor.key, {
      ...descriptor,
      variants: [variant],
    });
  });

  return [...groups.values()].flatMap((group) => {
    if (group.variants.length <= 8) return [group];
    const taggedGroups = new Map<string, CollectionVariantGroup>();
    group.variants.forEach((variant) => {
      const tag = shortParentheticalTag(variant.title);
      const key = `${group.key}:tag:${tag || "other"}`;
      const existing = taggedGroups.get(key);
      if (existing) {
        existing.variants.push(variant);
        return;
      }
      taggedGroups.set(key, {
        key,
        label: tag
          ? `${group.label} · ${tag}`
          : `${group.label} · ${language === "zh" ? "其他" : "Other"}`,
        variants: [variant],
      });
    });
    return taggedGroups.size > 1 ? [...taggedGroups.values()] : [group];
  });
}
