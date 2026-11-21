import {
  Atom,
  BookOpen,
  BookOpenText,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Code2,
  Cog,
  HeartPulse,
  Languages,
  GraduationCap,
  Landmark,
  Scale,
  Sigma,
} from "lucide-react";
import { useState } from "react";
import type { SubjectKey } from "../types";

interface CoverArtProps {
  cover: string;
  title: string;
  subject: SubjectKey;
}

const subjectIcons = {
  programming: Code2,
  language: Languages,
  math: Sigma,
  science: Atom,
  engineering: Cog,
  medicine: HeartPulse,
  law: Scale,
  politics: Landmark,
  humanities: BookOpenText,
  business: ChartNoAxesCombined,
  exam: GraduationCap,
  career: BriefcaseBusiness,
  general: BrainCircuit,
};

export function CoverArt({ cover, title, subject }: CoverArtProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = subjectIcons[subject] || BookOpen;

  if (cover && !imageFailed) {
    return (
      <img
        className="cover-art"
        src={cover}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className={`cover-fallback cover-${subject}`}>
      <div className="cover-grid" />
      <Icon size={48} strokeWidth={1.15} />
      <span>{title}</span>
    </div>
  );
}
