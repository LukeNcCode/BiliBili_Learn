import type {
  ClassifiedVideo,
  Language,
  LearningMode,
  SubjectKey,
  VideoCandidate,
} from "../types";
import type { LearningAffinityIndex } from "./learningAffinity";
import type { SemanticClassification } from "./localSemantic";

const subjectTerms: Record<SubjectKey, string[]> = {
  programming: [
    "计算机",
    "信息技术",
    "软件",
    "硬件",
    "编程",
    "代码",
    "python",
    "java",
    "javascript",
    "typescript",
    "rust",
    "算法",
    "前端",
    "后端",
    "全栈",
    "数据库",
    "架构",
    "开发",
    "运维",
    "网络安全",
    "云计算",
    "数据结构",
    "操作系统",
    "计算机网络",
    "linux",
    "git",
    "人工智能",
    "机器学习",
    "深度学习",
    "大模型",
    "transformer",
    "数据科学",
  ],
  language: [
    "英语",
    "日语",
    "韩语",
    "俄语",
    "西班牙语",
    "法语",
    "德语",
    "口语",
    "听力",
    "雅思",
    "托福",
    "四六级",
    "专四",
    "专八",
    "外语",
    "grammar",
    "language",
  ],
  math: [
    "数学",
    "线性代数",
    "微积分",
    "概率论",
    "几何",
    "矩阵",
    "函数",
    "方程",
    "概率",
    "统计",
    "离散数学",
    "线性规划",
    "数论",
    "博弈论",
    "高数",
    "math",
    "calculus",
  ],
  science: [
    "物理",
    "化学",
    "生物",
    "量子",
    "力学",
    "宇宙",
    "相对论",
    "天文",
    "科学",
    "实验",
    "地理",
    "地质",
    "气象",
    "环境科学",
    "physics",
    "chemistry",
    "biology",
    "science",
  ],
  engineering: [
    "工程",
    "工程技术",
    "自动控制",
    "控制理论",
    "经典控制",
    "现代控制",
    "控制系统",
    "控制工程",
    "控制原理",
    "信号与系统",
    "数字信号",
    "电子信息",
    "通信工程",
    "电气",
    "电机",
    "电力",
    "机械",
    "土木",
    "建筑",
    "化工",
    "材料科学",
    "航空航天",
    "车辆工程",
    "机器人",
    "嵌入式",
    "单片机",
    "plc",
    "传感器",
    "工程制图",
    "自动化",
    "engineering",
    "control theory",
    "control system",
    "automatic control",
    "electrical",
    "mechanical",
    "civil engineering",
    "robotics",
  ],
  medicine: [
    "医学",
    "临床",
    "护理",
    "药理",
    "药物",
    "解剖",
    "生理",
    "病理",
    "诊断",
    "治疗",
    "内科学",
    "外科学",
    "妇产科",
    "儿科",
    "口腔",
    "中医",
    "针灸",
    "公共卫生",
    "流行病",
    "循证医学",
    "执业医师",
    "规培",
    "medicine",
    "medical",
    "nursing",
    "anatomy",
    "pathology",
  ],
  law: [
    "法学",
    "法律",
    "民法",
    "刑法",
    "宪法",
    "行政法",
    "商法",
    "经济法",
    "诉讼法",
    "国际法",
    "法考",
    "法条",
    "司法",
    "判例",
    "合同",
    "知识产权",
    "law",
    "legal",
  ],
  politics: [
    "政治",
    "马克思主义",
    "马克思",
    "毛泽东思想",
    "邓小平理论",
    "中国特色社会主义",
    "思政",
    "考研政治",
    "政治学",
    "国际关系",
    "公共管理",
    "党史",
    "政治经济学",
    "politics",
    "political",
    "marxism",
  ],
  humanities: [
    "人文",
    "历史",
    "哲学",
    "心理学",
    "社会学",
    "文学",
    "语言学",
    "考古",
    "伦理",
    "宗教学",
    "传播学",
    "新闻学",
    "艺术史",
    "人类学",
    "history",
    "philosophy",
    "psychology",
    "sociology",
    "literature",
  ],
  business: [
    "经济",
    "金融",
    "管理",
    "商业",
    "会计",
    "审计",
    "市场营销",
    "运营管理",
    "财务管理",
    "创业",
    "投资",
    "宏观经济学",
    "微观经济学",
    "business",
    "economics",
    "finance",
    "accounting",
    "management",
  ],
  exam: [
    "考研",
    "高考",
    "中考",
    "真题",
    "复习",
    "考试",
    "期末",
    "考公",
    "专升本",
    "升学",
    "考博",
    "保研",
    "公考",
  ],
  career: [
    "职场",
    "面试",
    "简历",
    "效率",
    "项目管理",
    "产品经理",
    "职业",
    "设计",
    "学习方法",
    "笔记",
    "career",
    "productivity",
  ],
  general: [
    "课程",
    "教程",
    "公开课",
    "入门",
    "讲解",
    "知识",
    "通识",
    "社会",
    "lecture",
  ],
};

const strongLearningTerms = [
  "零基础",
  "教程",
  "课程",
  "公开课",
  "系统入门",
  "原理",
  "讲解",
  "详解",
  "分析",
  "解读",
  "实战",
  "真题",
  "复习",
  "考研",
  "期末",
  "量子",
  "物理",
  "数学",
  "经济学",
  "哲学",
  "心理学",
  "历史",
  "系列课",
  "系统课",
  "精品课",
  "网课",
  "教材",
  "讲义",
  "课堂",
  "考点",
  "考纲",
  "法考",
  "执业医师",
  "规培",
  "习题",
  "逐题",
  "完整项目",
  "速成",
  "lecture",
  "course",
  "tutorial",
  "explained",
  "masterclass",
];

const entertainmentTerms = [
  "鬼畜",
  "搞笑",
  "爆笑",
  "整活",
  "名场面",
  "游戏实况",
  "综艺",
  "影视解说",
  "吃瓜",
  "八卦",
  "短剧",
  "猎奇",
  "挑战",
  "开箱",
  "吐槽",
  "动画片",
  "游戏高能",
  "funny",
  "gameplay",
  "reaction",
  "meme",
];

const promotionalTerms = [
  "限时优惠",
  "立即下单",
  "点击购买",
  "优惠券",
  "领券",
  "课程咨询",
  "加微信",
  "推广",
  "赞助",
  "广告",
  "商单",
  "立即咨询",
  "buy now",
  "promo code",
  "sponsored",
];

const weakSubjectTerms = new Set([
  "科学",
  "实验",
  "技术",
  "社会",
  "知识",
  "课程",
  "讲解",
]);

export const modeThresholds: Record<LearningMode, number> = {
  focus: 0.62,
  balanced: 0.46,
  explore: 0.3,
};

function haystack(video: VideoCandidate) {
  return [
    video.title,
    video.description,
    video.category,
    video.recommendReason,
    ...video.tags,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLocaleLowerCase()));
}

function detectedSubjects(video: VideoCandidate) {
  const title = video.title.toLocaleLowerCase();
  const fields = [
    { text: title, weight: 4 },
    { text: video.tags.join(" ").toLocaleLowerCase(), weight: 0.7 },
    { text: video.description.toLocaleLowerCase(), weight: 0.4 },
    { text: video.category.toLocaleLowerCase(), weight: 0.25 },
    { text: video.recommendReason.toLocaleLowerCase(), weight: 0.2 },
  ];
  return (Object.entries(subjectTerms) as [SubjectKey, string[]][])
    .map(([subject, terms]) => ({
      subject,
      hits: terms.reduce(
        (total, term) =>
          total +
          fields.reduce((fieldTotal, field) => {
            if (!field.text.includes(term.toLocaleLowerCase())) return fieldTotal;
            const specificity = weakSubjectTerms.has(term) ? 0.55 : 1;
            return fieldTotal + field.weight * specificity;
          }, 0),
        0,
      ),
      titleHits: terms.reduce(
        (total, term) =>
          total +
          (title.includes(term.toLocaleLowerCase())
            ? weakSubjectTerms.has(term)
              ? 0.55
              : 1
            : 0),
        0,
      ),
    }))
    .sort((left, right) => right.hits - left.hits);
}

export function classifyVideo(
  video: VideoCandidate,
  mode: LearningMode,
  feedback: number,
  blockedAuthors: string[],
  learningAffinity?: LearningAffinityIndex | null,
): ClassifiedVideo {
  const text = haystack(video);
  const subjects = detectedSubjects(video);
  const strongestSpecific = subjects.find(
    (candidate) => candidate.subject !== "general" && candidate.hits > 0,
  );
  const subject =
    strongestSpecific?.subject ||
    (subjects[0]?.hits > 0 ? subjects[0].subject : "general");
  const reasons: string[] = [];
  const topics = [
    subject,
    ...subjects
      .filter(
        (candidate) =>
          candidate.subject !== "general" &&
          candidate.subject !== subject &&
          candidate.titleHits >= 1,
      )
      .map((candidate) => candidate.subject),
  ].filter((item, index, all) => all.indexOf(item) === index);

  const isPromotional = includesAny(text, promotionalTerms);
  const entertainmentHits = entertainmentTerms.filter((term) =>
    text.includes(term.toLocaleLowerCase()),
  );
  const learningHits = strongLearningTerms.filter((term) =>
    text.includes(term.toLocaleLowerCase()),
  );
  const hasAcademicSubject = subjects.some(
    (candidate) => candidate.subject !== "general" && candidate.hits > 0,
  );
  const hasCourseStructure =
    /第.{1,4}[章节讲篇单元]|chapter\s*\d|lesson\s*\d|lecture\s*\d|unit\s*\d/i.test(
      text,
    );
  const affinityMatch = learningAffinity?.match(video);

  let score = 0.18;
  if (learningHits.length > 0) {
    score += Math.min(0.36, learningHits.length * 0.14);
    reasons.push("reasonTutorial");
  }
  if (subjects[0]?.hits > 0) score += Math.min(0.22, subjects[0].hits * 0.09);
  if (hasAcademicSubject) {
    score += 0.14;
    reasons.push("reasonTechnical");
  }
  if (hasCourseStructure) {
    score += 0.12;
    reasons.push("reasonCourse");
  }
  if (video.duration >= 15 * 60) {
    score += 0.07;
    if (!reasons.includes("reasonCourse")) reasons.push("reasonCourse");
  }
  if (affinityMatch) {
    const affinityStrength = affinityMatch.exactVideo
      ? 1
      : Math.min(1, affinityMatch.score / 0.48);
    if (affinityStrength >= 0.18) {
      score += 0.27 * affinityStrength;
      reasons.unshift("reasonLearningList");
    }
  }
  if (video.tags.length >= 3) score += 0.035;
  if (video.recommendReason) score += 0.025;
  if (feedback > 0) {
    score += 0.16 * Math.min(feedback, 2);
    reasons.push("reasonFeedback");
  } else if (feedback < 0) {
    score -= 0.32 * Math.min(Math.abs(feedback), 2);
  }
  score -= Math.min(0.65, entertainmentHits.length * 0.24);
  if (isPromotional) score = Math.min(score, 0.15);
  if (affinityMatch?.exactVideo && !isPromotional) {
    score = Math.max(score, 0.78);
  }
  score += Math.max(0, 0.06 - video.position * 0.002);
  score = Math.max(0, Math.min(1, score));

  if (reasons.length === 0 && score > 0.3) reasons.push("reasonPosition");
  if (isPromotional) reasons.unshift("reasonAd");
  if (entertainmentHits.length > 0) reasons.unshift("reasonEntertainment");

  const isBlocked = blockedAuthors.includes(video.author);
  const route = isPromotional
    ? "ad"
    : score >= 0.62
      ? "learning"
      : score >= modeThresholds[mode]
        ? "adjacent"
        : "entertainment";
  const hidden =
    isBlocked ||
    route === "ad" ||
    route === "entertainment" ||
    score < modeThresholds[mode];

  return {
    ...video,
    learningScore: score,
    subject,
    topics,
    route,
    reasons: reasons.slice(0, 3),
    hidden,
    feedback,
  };
}

export function classifyFeed(
  videos: VideoCandidate[],
  mode: LearningMode,
  feedbackMap: Record<string, number>,
  blockedAuthors: string[],
  learningAffinity?: LearningAffinityIndex | null,
) {
  return videos
    .map((video) =>
      classifyVideo(
        video,
        mode,
        feedbackMap[video.bvid] || 0,
        blockedAuthors,
        learningAffinity,
      ),
    )
    .sort((left, right) => {
      const scoreDifference = right.learningScore - left.learningScore;
      if (Math.abs(scoreDifference) < 0.06) {
        return left.position - right.position;
      }
      return scoreDifference;
    });
}

export function scoreLabel(score: number, language: Language) {
  const percentage = Math.round(score * 100);
  return language === "zh" ? `学习匹配 ${percentage}%` : `Match ${percentage}%`;
}

export function applySemanticSubject(
  video: ClassifiedVideo,
  classification: SemanticClassification | undefined,
) {
  const minimumMargin = video.subject === "general" ? 0.025 : 0.08;
  if (
    !classification ||
    classification.score < 0.5 ||
    classification.margin < minimumMargin ||
    classification.subject === video.subject
  ) {
    return video;
  }
  return {
    ...video,
    subject: classification.subject,
    reasons: [
      "reasonSemantic",
      ...video.reasons.filter((reason) => reason !== "reasonSemantic"),
    ].slice(0, 3),
  };
}
