import { Router } from "express";
import { loadTransactions, getAccounts, getProfile } from "../lib/data.js";
import {
  monthlySummaries,
  categoryDeltas,
  detectFixedMerchants,
  detectSubscriptions,
  fixedVariableSplit,
  monthsOf,
  ratio503020,
  emergencyFund,
  debtVerdicts,
  goalProjections,
} from "../services/insights.js";

export const analysisRouter = Router();

analysisRouter.get("/analysis/summary", (req, res) => {
  const { transactions } = loadTransactions();
  const limit = Math.min(Number(req.query.months) || 12, 24);
  const summaries = monthlySummaries(transactions, limit);
  const months = monthsOf(transactions);
  const month = (req.query.month as string) || months[months.length - 1] || "";
  res.json({
    months,
    selectedMonth: month,
    monthly: summaries,
    deltas: categoryDeltas(summaries, month),
  });
});

analysisRouter.get("/analysis/insights", (_req, res) => {
  const { transactions } = loadTransactions();
  const { accounts } = getAccounts();
  const { profile } = getProfile();
  const fixed = detectFixedMerchants(transactions);
  const summaries = monthlySummaries(transactions);
  res.json({
    fixedMerchants: fixed,
    subscriptions: detectSubscriptions(fixed),
    fixedVariable: fixedVariableSplit(transactions, fixed),
    ratio503020: ratio503020(summaries),
    emergencyFund: emergencyFund(accounts, summaries),
    debts: debtVerdicts(profile.debts, profile.riskProfile),
    riskProfile: profile.riskProfile,
  });
});

analysisRouter.get("/goals", (_req, res) => {
  const { transactions } = loadTransactions();
  const { profile } = getProfile();
  const nowMonth = new Date().toISOString().slice(0, 7);
  res.json({
    goals: goalProjections(profile.goals, monthlySummaries(transactions), nowMonth),
  });
});
