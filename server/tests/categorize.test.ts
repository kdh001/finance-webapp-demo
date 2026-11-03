import { describe, it, expect } from "vitest";
import {
  CATEGORY_RULES,
  matchCategoryByRules,
  categorizeMerchant,
} from "../src/services/categorize.js";

describe("matchCategoryByRules — 순수 규칙 매칭", () => {
  const cases: Array<[string, number, string]> = [
    ["스타벅스 강남점", -5600, "카페/간식"],
    ["넷플릭스", -13500, "구독"],
    ["쿠팡와우멤버십", -7890, "구독"],
    ["쿠팡", -35000, "쇼핑"],
    ["쿠팡이츠", -18000, "식비"],
    ["월세 이체", -550000, "주거/통신"],
    ["적금 자동이체", -400000, "금융"],
    ["축의금 이체", -100000, "경조사/이체"],
    ["(주)테크컴퍼니 급여", 3000000, "수입"],
    ["티머니 충전", -55000, "교통"],
    ["튼튼약국", -9000, "의료/건강"],
    ["알수없는가게", -10000, "기타"],
    // 규칙 미매칭 양수 → 수입 추정
    ["미지의입금처", 50000, "수입"],
  ];

  it.each(cases)("%s (%i) → %s", (merchant, amount, expected) => {
    expect(matchCategoryByRules(merchant, amount).category).toBe(expected);
  });

  it("CATEGORY_RULES 는 비어 있지 않고 category·keywords 를 가진다", () => {
    expect(CATEGORY_RULES.length).toBeGreaterThan(5);
    for (const rule of CATEGORY_RULES) {
      expect(rule.category).toBeTruthy();
      expect(rule.keywords.length).toBeGreaterThan(0);
    }
  });

  it("구독 키워드가 쇼핑(쿠팡)보다 먼저 매칭된다", () => {
    // 규칙 표 순서 회귀 — 쿠팡와우가 쇼핑으로 떨어지면 안 됨
    expect(matchCategoryByRules("쿠팡와우", -5000).category).toBe("구독");
  });
});

describe("categorizeMerchant — 오버라이드 우선", () => {
  it("사용자 수정(override)이 규칙보다 우선", () => {
    const r = categorizeMerchant("스타벅스 강남점", -5600, {
      merchants: { "스타벅스 강남점": "식비" },
    });
    expect(r).toEqual({ category: "식비", source: "override" });
  });

  it("오버라이드 없으면 matchCategoryByRules 와 동일", () => {
    const pure = matchCategoryByRules("올리브영", -12000);
    const withOv = categorizeMerchant("올리브영", -12000, { merchants: {} });
    expect(withOv).toEqual(pure);
  });
});
