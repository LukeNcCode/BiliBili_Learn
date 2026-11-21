import type { SubjectKey } from "../types";

export interface SemanticSubjectDecision {
  subject: SubjectKey;
  score: number;
  margin: number;
}

export const semanticSubjectPrototypes: Record<SubjectKey, string> = {
  programming:
    "计算机编程与软件开发课程：Python、Java、JavaScript、前端、后端、数据库、算法、数据结构、操作系统、计算机网络、人工智能、机器学习、网络安全",
  engineering:
    "工程与技术课程：经典控制理论、自动控制原理、控制系统、信号与系统、通信工程、电子信息、电气工程、电机、机械工程、土木工程、机器人、嵌入式、单片机、PLC、传感器、工程制图",
  science:
    "自然科学：物理学、化学、生物学、天文学、量子力学、相对论、地理、地质、气象、环境科学、实验科学",
  math:
    "数学课程：高等数学、微积分、线性代数、概率论、数理统计、离散数学、几何、数学分析、博弈论、矩阵和函数",
  medicine:
    "医学课程：人体解剖学、组织胚胎学、生理学、病理学、药理学、临床诊断与治疗、内科学、外科学、妇产科、儿科、护理、口腔医学、中医学、公共卫生",
  law:
    "法学课程：民法、刑法、宪法、行政法、诉讼法、商法、经济法、国际法、法考、司法案例、合同、知识产权",
  politics:
    "政治学与思想政治教育：马克思主义、毛泽东思想、中国特色社会主义理论、考研政治、政治学原理、国际关系、公共管理、党史",
  humanities:
    "人文社会科学：中国史、世界史、哲学、心理学、社会学、文学、语言学、考古学、伦理学、传播学、新闻学",
  business:
    "经济管理：经济学、金融学、会计、审计、市场营销、企业管理、财务管理、投资、创业、运营管理",
  language:
    "语言学习：英语、日语、德语、法语、俄语、口语、听力、语法、单词、词汇、雅思、托福、翻译",
  exam:
    "考试升学备考：考研、高考、中考、公务员考试、真题、复习、考点、保研、考博",
  career:
    "职业发展：求职、面试、简历、职场、沟通表达、项目管理、产品经理、工作效率、学习方法",
  general: "一般知识讲解、百科、科普和通识课程",
};

export const semanticSubjectKeys = Object.keys(
  semanticSubjectPrototypes,
) as SubjectKey[];

export function chooseSemanticSubject(
  scores: Partial<Record<SubjectKey, number>>,
): SemanticSubjectDecision {
  const ranked = semanticSubjectKeys
    .map((subject) => ({
      subject,
      score: Number(scores[subject] || 0),
    }))
    .sort((left, right) => right.score - left.score);
  const first = ranked[0] || { subject: "general" as const, score: 0 };
  const second = ranked[1];
  return {
    subject: first.subject,
    score: first.score,
    margin: first.score - (second?.score || 0),
  };
}
