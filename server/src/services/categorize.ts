import type { Category, Transaction } from "../types.js";
import type { RawTransaction } from "./csv/parser.js";

/**
 * 카테고리 규칙 한 줄 — 순서가 우선순위.
 * 구체적 키워드를 앞에, 범용 키워드(이체·송금 등)를 뒤에 둔다.
 */
export interface CategoryRule {
  category: Category;
  keywords: readonly string[];
}

/**
 * 카테고리 규칙 표 (순수 데이터).
 * 매칭은 가맹점 문자열 포함 여부 — UI·시딩·테스트가 같은 표를 공유한다.
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "구독",
    keywords: [
      "넷플릭스", "netflix", "유튜브프리미엄", "유튜브 프리미엄", "youtube", "왓챠", "웨이브", "티빙", "디즈니",
      "스포티파이", "spotify", "멜론", "지니뮤직", "플로", "밀리의서재", "리디셀렉트", "쿠팡와우", "네이버플러스",
      "chatgpt", "openai", "claude", "anthropic", "어도비", "adobe", "노션", "notion", "아이클라우드", "icloud",
      "구글원", "google one", "멤버십",
    ],
  },
  {
    category: "카페/간식",
    keywords: [
      "스타벅스", "투썸", "이디야", "메가mgc", "메가커피", "컴포즈", "빽다방", "폴바셋", "할리스", "커피빈",
      "파스쿠찌", "공차", "던킨", "배스킨라빈스", "설빙", "와플", "디저트", "베이커리", "파리바게뜨", "뚜레쥬르",
      "카페", "커피", "코피", "주스", "쥬씨", "마카롱",
    ],
  },
  {
    category: "교통",
    keywords: [
      "티머니", "캐시비", "카카오t", "카카오 t", "택시", "지하철", "버스", "코레일", "srt", "ktx", "고속버스",
      "주유", "gs칼텍스", "sk에너지", "s-oil", "에쓰오일", "현대오일", "하이패스", "주차", "쏘카", "그린카",
      "따릉이", "킥보드", "지쿠", "빔모빌리티",
    ],
  },
  {
    category: "의료/건강",
    keywords: [
      "약국", "병원", "의원", "치과", "한의원", "내과", "외과", "이비인후과", "피부과", "안과", "정형외과",
      "산부인과", "검진", "헬스", "피트니스", "필라테스", "요가", "pt ",
    ],
  },
  {
    category: "문화/여가",
    keywords: [
      "cgv", "메가박스", "롯데시네마", "영화", "교보문고", "예스24", "yes24", "알라딘", "서점", "넥슨", "스팀",
      "steam", "플레이스테이션", "닌텐도", "노래방", "pc방", "피시방", "볼링", "당구", "전시", "공연", "티켓",
      "인터파크", "야놀자", "여기어때", "호텔", "리조트", "펜션", "에어비앤비", "airbnb", "항공", "대한항공",
      "아시아나", "제주항공", "진에어",
    ],
  },
  {
    category: "교육",
    keywords: [
      "인프런", "유데미", "udemy", "클래스101", "패스트캠퍼스", "학원", "교재", "강의", "스터디", "토익", "오픽",
    ],
  },
  {
    category: "주거/통신",
    keywords: [
      "월세", "관리비", "skt", "sk텔레콤", "kt ", "lg유플러스", "lgu+", "알뜰폰", "전기요금", "한전", "도시가스",
      "수도요금", "인터넷", "통신요금", "임대료",
    ],
  },
  {
    category: "식비",
    keywords: [
      "배달의민족", "요기요", "쿠팡이츠", "gs25", "cu ", "cu역삼", "세븐일레븐", "이마트24", "미니스톱", "편의점",
      "김밥", "맥도날드", "버거킹", "롯데리아", "kfc", "맘스터치", "서브웨이", "치킨", "피자", "반점", "본죽",
      "국밥", "식당", "분식", "마라", "샐러드", "포케", "돈까스", "돈가스", "초밥", "스시", "우동", "라멘",
      "쌀국수", "족발", "보쌈", "곱창", "삼겹", "갈비", "회관", "이마트 ", "이마트역삼", "홈플러스", "롯데마트",
      "마켓컬리", "컬리", "하나로마트", "식자재",
    ],
  },
  {
    category: "쇼핑",
    keywords: [
      "무신사", "올리브영", "쿠팡", "지그재그", "에이블리", "29cm", "w컨셉", "네이버페이", "스마트스토어", "11번가",
      "g마켓", "지마켓", "옥션", "위메프", "티몬", "다이소", "아트박스", "백화점", "아울렛", "유니클로", "자라",
      "zara", "h&m", "나이키", "아디다스", "아마존", "amazon", "알리익스프레스", "aliexpress", "테무", "이케아",
    ],
  },
  {
    category: "금융",
    keywords: [
      "적금", "예금", "저축", "파킹", "대출", "상환", "이자", "보험", "증권", "카드대금", "카드값", "펀드",
      "isa", "irp", "연금", "청약",
    ],
  },
  {
    category: "수입",
    keywords: ["급여", "월급", "상여", "성과급", "환급", "캐시백", "이자입금"],
  },
  {
    category: "경조사/이체",
    keywords: ["축의금", "부의금", "조의금", "경조", "용돈", "회비", "더치페이", "정산", "이체", "송금"],
  },
];

export interface Overrides {
  /** 가맹점명(정확 일치) → 카테고리. 사용자가 수정할 때마다 학습 저장 (FR-2.3) */
  merchants: Record<string, Category>;
}

/**
 * 키워드 규칙만으로 분류하는 순수함수.
 * 오버라이드·I/O·난수를 쓰지 않아 단위 테스트·시딩 스크립트에서 안전하게 재사용한다.
 */
export function matchCategoryByRules(
  merchant: string,
  amount: number,
): { category: Category; source: "rule" | "uncategorized" } {
  // 대소문자 혼용 가맹점(Netflix 등)을 한 번에 맞추기 위해 소문자로 정규화한다.
  const lower = merchant.toLowerCase();
  for (const { category, keywords } of CATEGORY_RULES) {
    if (keywords.some((k) => lower.includes(k))) {
      return { category, source: "rule" };
    }
  }
  // 규칙 미매칭 + 양수 금액 → 수입으로 추정 (급여 키워드가 빠진 입금 대비)
  if (amount > 0) return { category: "수입", source: "rule" };
  return { category: "기타", source: "uncategorized" };
}

/**
 * 사용자 오버라이드 → 규칙 순으로 분류.
 * 오버라이드가 있으면 source=override, 없으면 matchCategoryByRules 결과를 그대로 반환.
 */
export function categorizeMerchant(
  merchant: string,
  amount: number,
  overrides: Overrides,
): {
  category: Category;
  source: Transaction["categorySource"];
} {
  const ov = overrides.merchants[merchant.trim()];
  if (ov) return { category: ov, source: "override" };
  return matchCategoryByRules(merchant, amount);
}

export function categorizeAll(raw: RawTransaction[], overrides: Overrides): Transaction[] {
  return raw.map((tx) => {
    const { category, source } = categorizeMerchant(tx.merchant, tx.amount, overrides);
    return { ...tx, category, categorySource: source, isFixed: false };
  });
}
